"""
The one place the scripts talk to Studio Next (chain 61997), with genlayer-py
0.19.0rc2, the SDK line for consensus v0.6.

Trimmed from the Recourse Studio Next port (shared/chain.py), keeping its
measured rules:

  - Every write carries a fee deposit from Studio's own estimate of the call.
    A write Studio cannot simulate (one it expects the contract to refuse)
    gets a flat allocation and goes on chain to be refused there.
  - withdraw() pays at the root of its transaction, which needs an External
    allocation for the payee, or it ends "fee no_matching_allocation".
  - Decided is not success. A refusal is decided too. Success is ACCEPTED or
    FINALIZED with a return.
  - A write is retried only while the nonce proves it was never sent.
  - The faucet's answer is not evidence. The balance moving is.
  - Private keys live in .accounts.json, which git ignores. Only addresses are
    ever printed.
"""

from __future__ import annotations

import json
import os
import pathlib
import time
import typing

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from genlayer_py import create_account, create_client
from genlayer_py.chains import studio_devnet

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACT = ROOT / "contracts" / "unban.py"
DEPLOYMENT = ROOT / "deployment.json"
KEYS = ROOT / ".accounts.json"

GEN = 10**18
RPC = "https://studio-next.genlayer.com/api"
EXPLORER = "https://explorer-studio-dev.genlayer.com"
CHAIN_ID = 61997
studio_devnet.rpc_urls = {"default": {"http": [RPC]}}

# Studio drops TLS handshakes in bursts; absorb them below the SDK.
_SESSION = requests.Session()
_SESSION.mount("https://", HTTPAdapter(max_retries=Retry(
    total=12, connect=12, read=6, backoff_factor=0.7, backoff_max=20,
    status_forcelist=[408, 429, 500, 502, 503, 504],
    allowed_methods=frozenset(["POST", "GET"]), raise_on_status=False,
)))


def _install_session() -> None:
    from genlayer_py.provider import provider as _provider

    _provider.requests = _SESSION
    _SESSION.exceptions = requests.exceptions


_install_session()

# Studio Next refuses a phase allocation outside 30 to 600 time units.
MAX_TIMEUNITS = 600
FLAT = {
    "leaderTimeunitsAllocation": MAX_TIMEUNITS,
    "validatorTimeunitsAllocation": MAX_TIMEUNITS,
    "totalMessageFees": 0,
    "rotations": [1],
}
EXTERNAL_BUDGET = 10**15
EXTERNAL_GAS = {"gasLimit": 100000, "maxGasPrice": 10**9}
RETRIES = 10
BACKOFF = 1.6


def _external_node(recipient: str) -> dict:
    from genlayer_py.transactions.fees import (
        MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
        MessageType,
        derive_external_message_call_key,
        encode_external_message_fee_params,
    )

    return {
        "messageType": int(MessageType.External),
        "onAcceptance": False,
        "parentIndex": MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
        "recipient": recipient,
        "callKey": derive_external_message_call_key("0x"),
        "budget": EXTERNAL_BUDGET,
        "feeParams": encode_external_message_fee_params(EXTERNAL_GAS),
    }


def retry(what: str, fn, *args, **kwargs):
    """For reads and waits only. Writes go through Chain._guarded."""
    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as error:  # noqa: BLE001
            text = str(error)
            if any(s in text for s in ("reverted", "UserError", "[EXPECTED]", "insufficient", "execution failed")):
                raise
            last = error
            if attempt == RETRIES - 1:
                break
            print(f"  retry {attempt + 1}/{RETRIES} on {what}: {text[:110]}", flush=True)
            time.sleep(BACKOFF**attempt)
    raise RuntimeError(f"{what} failed after {RETRIES} attempts: {last}")


def _fee_options(estimate: dict) -> dict:
    options = {"distribution": estimate["distribution"], "feeValue": estimate["feeValue"]}
    if estimate.get("messageAllocations"):
        options["messageAllocations"] = estimate["messageAllocations"]
    return options


_READER = None


def _reader():
    global _READER
    if _READER is None:
        _READER = create_account()
    return _READER


class Chain:
    def __init__(self, account=None):
        self.account = account
        self.client = create_client(chain=studio_devnet, account=account)

    # -- money --------------------------------------------------------------

    def balance(self, address: str) -> int:
        try:
            return int(retry("get_balance", self.client.get_balance, address))
        except Exception:  # noqa: BLE001
            return 0

    def fund(self, address: str, amount: int) -> tuple[int, int]:
        """One faucet call, never retried; the balance difference is the evidence."""
        before = self.balance(address)
        try:
            self.client.fund_account(address, amount)
        except Exception as error:  # noqa: BLE001
            print(f"  fund_account said {str(error)[:80]}; reading the balance instead", flush=True)
        after = before
        for _ in range(10):
            after = self.balance(address)
            if after > before:
                break
            time.sleep(2)
        print(f"  {address} {before / GEN:.2f} -> {after / GEN:.2f} GEN", flush=True)
        return before, after

    # -- contracts ----------------------------------------------------------

    def schema_for_code(self, code: str):
        return retry("schema for code", self.client.get_contract_schema_for_code, code)

    def deploy(self, path: pathlib.Path, args: list) -> dict:
        code = path.read_text(encoding="utf-8")
        fees = _fee_options(retry("deploy fee estimate", self.client.estimate_transaction_fees, FLAT))
        tx = self._guarded("deploy", lambda: self.client.deploy_contract(code=code, args=args, fees=fees))
        receipt = self.wait(tx, finalized=True, retries=150)
        outcome = check(receipt)
        if not outcome["ok"]:
            raise RuntimeError(f"deploy did not succeed: {outcome['detail']}")
        address = _find_key(receipt, ("contract_address", "contractAddress"))
        if not isinstance(address, str) or not address.startswith("0x"):
            raise RuntimeError("deploy finalized with no address")
        # EVM code can exist before the GenVM deployment does; the schema is the probe.
        retry("get_contract_schema", self.client.get_contract_schema, address)
        return {"address": address, "hash": _hash(tx)}

    def read(self, address: str, method: str, args: list | None = None):
        return retry("read " + method, lambda: self.client.read_contract(
            address=address, function_name=method, args=args or [], account=self.account or _reader()))

    def read_json(self, address: str, method: str, args: list | None = None) -> typing.Any:
        return json.loads(self.read(address, method, args))

    def _fees(self, address: str, method: str, args: list, value: int) -> dict:
        try:
            estimate = retry("fee estimate for " + method, self.client.estimate_transaction_fees_for_write,
                             address=address, function_name=method, account=self.account, args=args, value=value)
        except RuntimeError:
            raise
        except Exception:  # noqa: BLE001  Studio could not simulate it
            flat = dict(FLAT)
            if method == "withdraw" and self.account is not None:
                del flat["totalMessageFees"]
                flat["messageAllocations"] = [_external_node(self.account.address)]
            estimate = retry("flat fee estimate", self.client.estimate_transaction_fees, flat)
        return _fee_options(estimate)

    def write(self, address: str, method: str, args: list | None = None, value: int = 0):
        def attempt():
            return self.client.write_contract(
                address=address, function_name=method, args=args or [], value=value,
                fees=self._fees(address, method, args or [], value))

        return self._guarded("write " + method, attempt)

    def send(self, address: str, method: str, args: list | None = None, value: int = 0,
             finalized: bool = False, expect_refusal: bool = False) -> dict:
        tx = self.write(address, method, args, value)
        receipt = self.wait(tx, finalized=finalized)
        outcome = check(receipt)
        outcome["hash"] = _hash(tx)
        outcome["method"] = method
        if not outcome["ok"] and not expect_refusal:
            raise RuntimeError(f"{method} failed ({outcome['hash']}): {outcome['detail']}")
        return outcome

    def _guarded(self, what: str, attempt):
        sender = self.account.address if self.account else None
        last: Exception | None = None
        for index in range(RETRIES):
            before = self._nonce(sender)
            try:
                return attempt()
            except Exception as error:  # noqa: BLE001
                text = str(error)
                if any(s in text for s in ("reverted", "UserError", "[EXPECTED]", "insufficient")):
                    raise
                last = error
                after = self._nonce(sender)
                if before is None or after is None or after > before:
                    raise RuntimeError(f"{what}: may already be sent (nonce {before} -> {after}); not resending: {text[:120]}") from error
                if index == RETRIES - 1:
                    break
                print(f"  retry {index + 1}/{RETRIES} on {what}: {text[:110]}", flush=True)
                time.sleep(BACKOFF**index)
        raise RuntimeError(f"{what} failed after {RETRIES} attempts: {last}")

    def _nonce(self, sender) -> int | None:
        if sender is None:
            return None
        try:
            return int(retry("nonce", self.client.get_current_nonce, address=sender))
        except Exception:  # noqa: BLE001
            return None

    def wait(self, tx_hash, finalized: bool = False, retries: int = 100) -> dict:
        return retry("wait", self.client.wait_for_transaction_receipt, transaction_hash=tx_hash,
                     wait_until="finalized" if finalized else "decided", interval=3000, retries=retries)


# --- reading a receipt honestly -----------------------------------------------

def _hash(tx) -> str:
    return tx if isinstance(tx, str) else getattr(tx, "hex", lambda: str(tx))()


def _find_key(node, names):
    if isinstance(node, dict):
        for key, value in node.items():
            if key in names and value:
                return value
        for value in node.values():
            hit = _find_key(value, names)
            if hit:
                return hit
    elif isinstance(node, list):
        for value in node:
            hit = _find_key(value, names)
            if hit:
                return hit
    return None


def receipt_status(receipt: dict) -> str:
    lifecycle = receipt.get("lifecycle")
    if isinstance(lifecycle, dict) and lifecycle.get("state"):
        state = str(lifecycle["state"]).lower()
        outcome = str(lifecycle.get("outcome") or "").lower()
        if outcome in ("", "accepted"):
            return {"decided": "ACCEPTED", "finalized": "FINALIZED"}.get(state, state.upper())
        return outcome.upper()
    return str(receipt.get("status", "")).upper()


def check(receipt) -> dict:
    """Success is ACCEPTED or FINALIZED and a return. Anything else carries the contract's sentence."""
    if not isinstance(receipt, dict):
        return {"ok": False, "status": "?", "detail": str(receipt)[:300], "refusal": "", "result": None}
    status = receipt_status(receipt)
    leader = (receipt.get("consensus_data") or {}).get("leader_receipt") or [{}]
    if isinstance(leader, dict):
        leader = [leader]
    first = leader[0] if leader else {}
    execution = str(receipt.get("txExecutionResultName") or receipt.get("tx_execution_result_name")
                    or first.get("execution_result", "")).upper()
    outcome = first.get("result") or {}
    refusal = ""
    if isinstance(outcome, dict) and str(outcome.get("status", "")).lower() in ("rollback", "user_error"):
        payload = outcome.get("payload")
        refusal = payload if isinstance(payload, str) else str(payload)
    ok = status in ("ACCEPTED", "FINALIZED") and execution in ("SUCCESS", "FINISHED_WITH_RETURN", "")
    result = None
    if isinstance(outcome, dict) and str(outcome.get("status", "")).lower() == "return":
        payload = outcome.get("payload")
        result = payload.get("readable") if isinstance(payload, dict) else payload
    return {
        "ok": ok,
        "status": status,
        "execution": execution,
        "refusal": refusal,
        "detail": "" if ok else f"status={status} execution={execution} {refusal}".strip(),
        "result": result,
    }


def explorer_tx(tx_hash: str) -> str:
    return f"{EXPLORER}/tx/{tx_hash}"


def explorer_address(address: str) -> str:
    return f"{EXPLORER}/address/{address}"


# --- records and keys ----------------------------------------------------------

def load_deployment() -> dict:
    if not DEPLOYMENT.exists():
        raise SystemExit("deployment.json is missing. Run: python scripts/deploy.py")
    return json.loads(DEPLOYMENT.read_text(encoding="utf-8"))


def save_deployment(record: dict) -> None:
    DEPLOYMENT.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")


def accounts(names: typing.Iterable[str]) -> dict:
    """
    Test accounts kept in .accounts.json (git ignores it). Missing names are
    created. Only addresses are ever printed: the secret is in the values.
    """
    raw = json.loads(KEYS.read_text(encoding="utf-8")) if KEYS.exists() else {}
    made = False
    for name in names:
        if name not in raw:
            raw[name] = create_account().key.hex()
            made = True
    if made:
        KEYS.write_text(json.dumps(raw, indent=2) + "\n", encoding="utf-8")
        os.chmod(KEYS, 0o600)
    return {name: create_account(account_private_key=raw[name]) for name in names}
