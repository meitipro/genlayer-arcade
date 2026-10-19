"""
One place that talks to Studio Next (chain 61997), used by deploy, the golden
run, the reviewer's path and the seed. Ported from the Recourse Studio Next
client (shared/chain.py), trimmed to the one network Samepage runs on.

The measured rules it keeps:

  - Every write on consensus v0.6 carries a fee deposit from Studio's own
    estimate of the call; what is not spent comes back at finality. Time-unit
    allocations stay inside 30 to 600, outside which the consensus contract
    reverts before the transaction exists.
  - withdraw pays at the root of its own transaction, so it is sent with an
    External allocation naming the caller, the payee. Without it a payout
    finishes "fee no_matching_allocation # external".
  - Accepted is a consensus status, not a result. A refusal is accepted too.
    Success is a settled status AND an execution that finished with a return.
  - A write is retried only while it is provably unsent: the nonce is read
    before and after, and a moved nonce is never sent again.
  - Studio's faucet is judged by the balance moving, never by its answer, and
    takes a checksummed address with the amount as a decimal string.
  - Accounts are made fresh for each run and never written anywhere. Only
    addresses are printed.
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
CONTRACT = ROOT / "contracts" / "samepage.py"
DEPLOYMENTS = ROOT / "deployments.json"

GEN = 10**18
TERMS_ORDER = ["amount", "deliverable", "deadline", "payment", "rights", "cancellation"]
RPC = "https://studio-next.genlayer.com/api"
CHAIN_ID = 61997
EXPLORER = "https://explorer-studio-dev.genlayer.com"

studio_devnet.rpc_urls = {"default": {"http": [RPC]}}

# --- transport ------------------------------------------------------------
_SESSION = requests.Session()
_SESSION.mount(
    "https://",
    HTTPAdapter(
        max_retries=Retry(
            total=12, connect=12, read=6, backoff_factor=0.7, backoff_max=20,
            status_forcelist=[408, 429, 500, 502, 503, 504],
            allowed_methods=frozenset(["POST", "GET"]), raise_on_status=False,
        ),
        pool_connections=2, pool_maxsize=8,
    ),
)


def _install_session() -> None:
    from genlayer_py.provider import provider as _provider

    if getattr(_provider, "_samepage_session", False):
        return
    _provider.requests = _SESSION
    _SESSION.exceptions = requests.exceptions
    _provider._samepage_session = True


_install_session()

RETRIES = 10
BACKOFF = 1.6
MAX_TIMEUNITS = 600

DEPLOY_FEES = {
    "leaderTimeunitsAllocation": MAX_TIMEUNITS,
    "validatorTimeunitsAllocation": MAX_TIMEUNITS,
    "totalMessageFees": 0,
    "rotations": [1],
}
FLAT_FEES = dict(DEPLOY_FEES)
EXTERNAL_BUDGET = 10**15
EXTERNAL_GAS = {"gasLimit": 100000, "maxGasPrice": 10**9}


def rpc(method: str, params: list) -> dict:
    """A raw JSON-RPC call to Studio Next, for the methods the SDK does not wrap."""
    response = _SESSION.post(
        RPC, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=60
    )
    return response.json()


def tx_url(tx: str) -> str:
    return f"{EXPLORER}/tx/{tx}"


def address_url(address: str) -> str:
    return f"{EXPLORER}/address/{address}"


def _external_node(recipient: str) -> dict:
    """One External allocation at the root of the tree, for a value transfer to recipient."""
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
    """Call fn again on a transient failure. For READS and WAITS only."""
    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as error:  # noqa: BLE001
            text = str(error)
            if any(k in text for k in ("reverted", "UserError", "[EXPECTED]", "insufficient", "execution failed")):
                raise
            last = error
            if attempt == RETRIES - 1:
                break
            print(f"  retry {attempt + 1}/{RETRIES} on {what}: {text[:110]}", flush=True)
            time.sleep(BACKOFF**attempt)
    raise RuntimeError(f"{what} failed after {RETRIES} attempts: {last}")


_READER = None


def _reader():
    """A throwaway account for reads, which consensus v0.6 refuses without one."""
    global _READER
    if _READER is None:
        _READER = create_account()
    return _READER


def _fee_options(estimate: dict) -> dict:
    options = {"distribution": estimate["distribution"], "feeValue": estimate["feeValue"]}
    allocations = estimate.get("messageAllocations")
    if allocations:
        options["messageAllocations"] = allocations
    return options


def fresh(label: str):
    """A new account for this run. Only its address is ever printed."""
    account = create_account()
    print(f"  {label:10} {account.address}", flush=True)
    return account


class Chain:
    def __init__(self, account=None):
        self.account = account
        self.client = create_client(chain=studio_devnet, account=account)

    def as_(self, account) -> "Chain":
        return Chain(account)

    # -- accounts ----------------------------------------------------------

    def fund(self, address: str, amount: int) -> int:
        """
        Fund through Studio's faucet; returns the balance that actually arrived.
        One attempt, never a retry: the faucet has been measured crediting and
        then answering an error, so a retry on error would credit twice.
        """
        from eth_utils import to_checksum_address

        address = to_checksum_address(address)
        before = self.balance(address)
        try:
            answer = rpc("sim_fundAccount", [address, str(int(amount))])
            if "error" in answer:
                print(f"  sim_fundAccount answered {str(answer['error'])[:90]}, reading the balance instead", flush=True)
        except Exception as error:  # noqa: BLE001
            print(f"  sim_fundAccount failed {str(error)[:90]}, reading the balance instead", flush=True)
        after = before
        for _ in range(20):
            after = self.balance(address)
            if after > before:
                break
            time.sleep(1.5)
        print(f"  funded {address[:10]} {before / GEN:.2f} -> {after / GEN:.2f} GEN", flush=True)
        return after - before

    def balance(self, address: str) -> int:
        try:
            return int(retry("get_balance", self.client.get_balance, address))
        except Exception:  # noqa: BLE001
            return 0

    # -- contracts ---------------------------------------------------------

    def deploy(self, code: str, args: list) -> dict:
        call = {"code": code, "args": args}
        call["fees"] = _fee_options(retry("deploy fee estimate", self.client.estimate_transaction_fees, DEPLOY_FEES))
        tx = self._guarded("deploy", lambda: self.client.deploy_contract(**call))
        tx_hash = _hash(tx)
        receipt = self.wait(tx_hash, finalized=True, retries=200)
        outcome = check(receipt)
        if not outcome["ok"]:
            raise RuntimeError(f"deploy did not succeed: {outcome['detail']}")
        address = _contract_address(receipt)
        if not address:
            raise RuntimeError(f"deploy finalized with no address: {_summary(receipt)}")
        retry("get_contract_schema", self.client.get_contract_schema, address)
        return {"address": address, "tx": tx_hash}

    def read(self, address: str, method: str, args: list | None = None):
        return retry(
            "read " + method,
            lambda: self.client.read_contract(
                address=address, function_name=method, args=args or [],
                account=self.account or _reader(),
            ),
        )

    def read_json(self, address: str, method: str, args: list | None = None) -> dict:
        return json.loads(self.read(address, method, args))

    def write(self, address: str, method: str, args: list | None = None, value: int = 0) -> str:
        def attempt():
            call = {"address": address, "function_name": method, "args": args or [], "value": value}
            call["fees"] = self._write_fees(address, method, args or [], value)
            return self.client.write_contract(**call)

        return _hash(self._guarded("write " + method, attempt))

    def _write_fees(self, address: str, method: str, args: list, value: int) -> dict:
        if method == "withdraw":
            # Studio cannot simulate a payout, and a flat allocation funds no
            # message, so the payee is named at the root of the tree.
            flat = dict(FLAT_FEES)
            del flat["totalMessageFees"]
            flat["messageAllocations"] = [_external_node(self.account.address)]
            return _fee_options(retry("withdraw fee estimate", self.client.estimate_transaction_fees, flat))
        try:
            estimate = retry(
                "fee estimate for " + method,
                self.client.estimate_transaction_fees_for_write,
                address=address, function_name=method, account=self.account,
                args=args, value=value,
            )
        except RuntimeError:
            raise
        except Exception:  # noqa: BLE001  a write Studio expects to be refused, or cannot simulate
            estimate = retry("flat fee estimate", self.client.estimate_transaction_fees, FLAT_FEES)
        return _fee_options(estimate)

    def _guarded(self, what: str, attempt):
        sender = self.account.address if self.account else None
        last: Exception | None = None
        for index in range(RETRIES):
            before = self._nonce(sender)
            try:
                return attempt()
            except Exception as error:  # noqa: BLE001
                text = str(error)
                if any(k in text for k in ("reverted", "UserError", "[EXPECTED]", "insufficient")):
                    raise
                last = error
                after = self._nonce(sender)
                if sender is not None and (before is None or after is None):
                    raise RuntimeError(f"{what}: failed and the nonce could not be read, not resending: {text[:120]}") from error
                if before is not None and after is not None and after > before:
                    raise RuntimeError(f"{what}: the node took a transaction (nonce {before} -> {after}) and the answer was lost: {text[:120]}. Not resending.") from error
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

    def wait(self, tx_hash: str, finalized: bool = False, retries: int = 120) -> dict:
        return retry(
            "wait",
            self.client.wait_for_transaction_receipt,
            transaction_hash=tx_hash,
            wait_until="finalized" if finalized else "decided",
            interval=3000,
            retries=retries,
        )

    def send(self, address: str, method: str, args: list | None = None, value: int = 0,
             finalized: bool = False, expect_refusal: bool = False) -> dict:
        """
        Write and wait, and return the outcome checked for a real success. With
        expect_refusal, a refusal is the outcome wanted and a success raises.
        """
        tx = self.write(address, method, args, value)
        receipt = self.wait(tx, finalized=finalized, retries=200 if method == "check" else 120)
        outcome = check(receipt)
        outcome["hash"] = tx
        outcome["url"] = tx_url(tx)
        if expect_refusal:
            if outcome["ok"]:
                raise RuntimeError(f"{method} was expected to be refused and succeeded: {tx}")
            return outcome
        if not outcome["ok"]:
            raise RuntimeError(f"{method} failed: {outcome['detail']} ({tx})")
        return outcome


# --- reading a receipt honestly -------------------------------------------
def _hash(tx) -> str:
    if isinstance(tx, str):
        return tx
    if isinstance(tx, (bytes, bytearray)):
        return "0x" + bytes(tx).hex()
    return getattr(tx, "hex", lambda: str(tx))()


def _contract_address(receipt) -> str | None:
    found = _find_key(receipt, ("contract_address", "contractAddress"))
    return found if isinstance(found, str) and found.startswith("0x") else None


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


def _summary(receipt) -> str:
    if not isinstance(receipt, dict):
        return str(receipt)[:300]
    keep = {k: receipt.get(k) for k in ("status", "lifecycle", "tx_id", "hash", "type") if k in receipt}
    return json.dumps(keep, default=str)[:300]


STATUS_NAMES = {
    0: "UNINITIALIZED", 1: "PENDING", 2: "PROPOSING", 3: "COMMITTING", 4: "REVEALING",
    5: "ACCEPTED", 6: "UNDETERMINED", 7: "FINALIZED", 8: "CANCELED", 9: "APPEAL_REVEALING",
    10: "APPEAL_COMMITTING", 11: "VALIDATORS_TIMEOUT", 12: "LEADER_TIMEOUT", 13: "LEADER_REVEALING",
}
SETTLED = ("ACCEPTED", "FINALIZED")


def receipt_status(receipt: dict) -> str:
    lifecycle = receipt.get("lifecycle")
    if isinstance(lifecycle, dict) and lifecycle.get("state"):
        state = str(lifecycle["state"]).lower()
        outcome = str(lifecycle.get("outcome") or "").lower()
        if outcome in ("", "accepted"):
            return {"decided": "ACCEPTED", "finalized": "FINALIZED"}.get(state, state.upper())
        return outcome.upper()
    raw = receipt.get("status", "")
    if isinstance(raw, int):
        return STATUS_NAMES.get(raw, f"STATUS_{raw}")
    text = str(raw).strip()
    return STATUS_NAMES.get(int(text), text) if text.isdigit() else text.upper()


def check(receipt) -> dict:
    """
    ok only when the status is ACCEPTED or FINALIZED and the execution finished
    with a return. A refusal is accepted by consensus too; its sentence is the
    payload of the leader's result.
    """
    if not isinstance(receipt, dict):
        return {"ok": False, "status": "?", "detail": str(receipt)[:300], "refusal": "", "result": None}
    status = receipt_status(receipt)
    consensus = receipt.get("consensus_data") or {}
    leader = consensus.get("leader_receipt") or [{}]
    if isinstance(leader, dict):
        leader = [leader]
    first = leader[0] if leader else {}
    execution = str(
        receipt.get("txExecutionResultName")
        or receipt.get("tx_execution_result_name")
        or first.get("execution_result", "")
    ).upper()
    outcome = first.get("result") or {}
    refusal = ""
    if isinstance(outcome, dict) and str(outcome.get("status", "")).lower() in ("rollback", "user_error"):
        payload = outcome.get("payload")
        refusal = payload if isinstance(payload, str) else str(payload)
    ok = status in SETTLED and execution in ("SUCCESS", "FINISHED_WITH_RETURN", "")
    detail = ""
    if not ok:
        detail = f"status={status} execution={execution} {refusal}".strip()
    return {
        "ok": ok,
        "status": status,
        "execution": execution,
        "detail": detail,
        "refusal": refusal,
        "result": _returned(first),
    }


def _returned(leader_receipt: dict) -> typing.Any:
    outcome = leader_receipt.get("result")
    if isinstance(outcome, dict) and str(outcome.get("status", "")).lower() == "return":
        payload = outcome.get("payload")
        if isinstance(payload, dict) and "readable" in payload:
            try:
                return json.loads(payload["readable"])
            except (ValueError, TypeError):
                return payload["readable"]
        return payload
    return outcome


# --- the deployment record ------------------------------------------------
def deployments() -> dict:
    if not DEPLOYMENTS.exists():
        return {}
    return json.loads(DEPLOYMENTS.read_text(encoding="utf-8"))


def current_address() -> str:
    record = deployments()
    address = os.environ.get("SAMEPAGE_ADDRESS") or record.get("current", {}).get("address")
    if not address:
        raise SystemExit("no deployment: run scripts/deploy.py first")
    return address


def save_json(path: pathlib.Path, data) -> None:
    """Persist before printing (rule 33): a run that costs consensus never depends on a terminal."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


# region: seal_of
def seal_of(text: str, salt: str, address: str) -> str:
    import hashlib

    return hashlib.sha256((text + "|" + salt + "|" + address.lower()).encode("utf-8")).hexdigest()
# endregion


def new_salt() -> str:
    return os.urandom(16).hex()
