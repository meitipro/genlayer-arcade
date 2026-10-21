"""
The one module that talks to GenLayer, used by deploy.py, seed.py,
e2e.py and eval/run_golden.py. Studio Next only (chain 61997), with
genlayer-py 0.19.0rc2, the consensus v0.6 line of the SDK.

Ported from the Recourse project's shared/chain.py, which carries the Studio
Next lessons this repository depends on:

- every write carries a fee deposit from the SDK's estimate, with time-unit
  allocations between 30 and 600;
- a write Studio cannot simulate (one it expects to be refused, or withdraw)
  gets a flat allocation, and withdraw gets an External node at the root of
  its allocation tree for the top-level transfer to the caller;
- ACCEPTED is a consensus status, not a result: a refusal is ACCEPTED too, so
  check() reads the leader's execution result before calling anything a
  success;
- the faucet is judged by the balance before and after, never by its answer;
- a write is never resent once the account's nonce has moved.
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
DEPLOYED = ROOT / "deployed.json"
#: Test account keys. Kept out of git (.gitignore) and never printed: scripts
#: print addresses, derived from the keys, and nothing else.
KEYS = ROOT / ".accounts.json"
CONTRACT = ROOT / "contracts" / "unban.py"

GEN = 10**18
CHAIN_ID = 61997
RPC = os.environ.get("UNBAN_RPC", "https://studio-next.genlayer.com/api")
EXPLORER = "https://explorer-studio-dev.genlayer.com"

studio_devnet.rpc_urls = {"default": {"http": [RPC]}}

# --- transport ------------------------------------------------------------
# Studio drops TLS handshakes in bursts and allows about thirty requests a
# minute. A retrying session under the SDK absorbs both.
_SESSION = requests.Session()
_SESSION.mount(
    "https://",
    HTTPAdapter(
        max_retries=Retry(
            total=12, connect=12, read=6, backoff_factor=0.7, backoff_max=20,
            status_forcelist=[408, 429, 500, 502, 503, 504],
            allowed_methods=frozenset(["POST", "GET"]), raise_on_status=False,
        ),
        pool_connections=2,
        pool_maxsize=8,
    ),
)


def _install_session() -> None:
    from genlayer_py.provider import provider as _provider

    if getattr(_provider, "_unban_session", False):
        return
    _provider.requests = _SESSION
    _SESSION.exceptions = requests.exceptions
    _provider._unban_session = True


_install_session()

RETRIES = 10
BACKOFF = 1.6

#: Studio Next refuses a phase allocation outside 30 to 600 time units before
#: the transaction exists (PhaseTimeoutOutOfBounds).
MAX_TIMEUNITS = 600
FLAT_FEES = {
    "leaderTimeunitsAllocation": MAX_TIMEUNITS,
    "validatorTimeunitsAllocation": MAX_TIMEUNITS,
    "totalMessageFees": 0,
    "rotations": [1],
}
#: The one write that pays, at the root of its own allocation tree.
ROOT_PAYOUTS = ("withdraw",)
EXTERNAL_BUDGET = 10**15
EXTERNAL_GAS = {"gasLimit": 100000, "maxGasPrice": 10**9}


def tx_url(tx: str) -> str:
    return f"{EXPLORER}/tx/{tx}"


def address_url(address: str) -> str:
    return f"{EXPLORER}/address/{address}"


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
    """Retry a READ or a WAIT on a transient failure. Writes go through Chain._guarded."""
    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as error:  # noqa: BLE001
            text = str(error)
            if "reverted" in text or "UserError" in text or "[EXPECTED]" in text \
                    or "insufficient" in text or "execution failed" in text:
                raise
            last = error
            if attempt == RETRIES - 1:
                break
            print(f"  retry {attempt + 1}/{RETRIES} on {what}: {text[:110]}")
            time.sleep(BACKOFF**attempt)
    raise RuntimeError(f"{what} failed after {RETRIES} attempts: {last}")


def _fee_options(estimate: dict) -> dict:
    options = {"distribution": estimate["distribution"], "feeValue": estimate["feeValue"]}
    if estimate.get("messageAllocations"):
        options["messageAllocations"] = estimate["messageAllocations"]
    return options


_READER = None


def _reader():
    """A throwaway account for reads, which v0.6 refuses without one. Never signs, never funded."""
    global _READER
    if _READER is None:
        _READER = create_account()
    return _READER


class Chain:
    def __init__(self, account=None, client=None):
        self.account = account
        self.client = client if client is not None else create_client(chain=studio_devnet, account=account)

    def fund(self, address: str, amount: int) -> int:
        """Studio's faucet. Returns what actually arrived, read from the balance."""
        before = self.balance(address)
        try:
            self.client.fund_account(address, amount)
        except Exception as error:  # noqa: BLE001
            print(f"  fund_account reported {str(error)[:90]}, reading the balance instead")
        for _ in range(10):
            after = self.balance(address)
            if after > before:
                break
            time.sleep(2)
        print(f"  {address[:10]} {before / GEN:.2f} -> {after / GEN:.2f} GEN")
        return after - before

    def balance(self, address: str) -> int:
        try:
            return int(retry("get_balance", self.client.get_balance, address))
        except Exception:  # noqa: BLE001
            return 0

    def deploy(self, path: pathlib.Path, args: list) -> tuple[str, str]:
        code = path.read_text(encoding="utf-8")
        call = {"code": code, "args": args,
                "fees": _fee_options(retry("deploy fee estimate", self.client.estimate_transaction_fees, FLAT_FEES))}
        tx = self._guarded("deploy", lambda: self.client.deploy_contract(**call))
        receipt = self.wait(tx, "FINALIZED", retries=150)
        outcome = check(receipt)
        if not outcome["ok"]:
            raise RuntimeError(f"deploy did not succeed: {outcome['detail']}")
        address = _find_key(receipt, ("contract_address", "contractAddress"))
        if not isinstance(address, str) or not address.startswith("0x"):
            raise RuntimeError("deploy finalized with no address")
        retry("get_contract_schema", self.client.get_contract_schema, address)
        return address, _hash(tx)

    def read(self, address: str, method: str, args: list | None = None):
        return retry(
            "read " + method,
            lambda: self.client.read_contract(
                address=address, function_name=method, args=args or [], account=self.account or _reader(),
            ),
        )

    def read_json(self, address: str, method: str, args: list | None = None):
        return json.loads(self.read(address, method, args))

    def write(self, address: str, method: str, args: list | None = None, value: int = 0) -> str:
        def attempt():
            return self.client.write_contract(
                address=address, function_name=method, args=args or [], value=value,
                fees=self._write_fees(address, method, args or [], value),
            )

        return self._guarded("write " + method, attempt)

    def estimate(self, address: str, method: str, args: list, value: int) -> int:
        """The fee deposit in wei, as the site shows it before signing."""
        return int(self._write_fees(address, method, args, value)["feeValue"])

    def _write_fees(self, address: str, method: str, args: list, value: int) -> dict:
        if method not in ROOT_PAYOUTS:
            try:
                estimate = retry(
                    "fee estimate for " + method, self.client.estimate_transaction_fees_for_write,
                    address=address, function_name=method, account=self.account, args=args, value=value,
                )
                return _fee_options(estimate)
            except RuntimeError:
                raise
            except Exception:  # noqa: BLE001  a write Studio expects to be refused
                pass
        flat = dict(FLAT_FEES)
        if method in ROOT_PAYOUTS and self.account is not None:
            # The SDK derives the message total from the allocations; a stated 0
            # beside a budget reverts with MessageAllocationsNotEqualBudget.
            del flat["totalMessageFees"]
            flat["messageAllocations"] = [_external_node(self.account.address)]
        return _fee_options(retry("flat fee estimate", self.client.estimate_transaction_fees, flat))

    def _guarded(self, what: str, attempt):
        """Retry only while the nonce proves nothing was sent."""
        sender = self.account.address if self.account else None
        last: Exception | None = None
        for index in range(RETRIES):
            before = self._nonce(sender)
            try:
                return attempt()
            except Exception as error:  # noqa: BLE001
                text = str(error)
                if "reverted" in text or "UserError" in text or "[EXPECTED]" in text or "insufficient" in text:
                    raise
                last = error
                after = self._nonce(sender)
                if sender is not None and (before is None or after is None or after > before):
                    raise RuntimeError(f"{what}: may have been sent ({text[:120]}). Not resending.") from error
                if index == RETRIES - 1:
                    break
                print(f"  retry {index + 1}/{RETRIES} on {what}: {text[:110]}")
                time.sleep(BACKOFF**index)
        raise RuntimeError(f"{what} failed after {RETRIES} attempts: {last}")

    def _nonce(self, sender) -> int | None:
        if sender is None:
            return None
        try:
            return int(retry("nonce", self.client.get_current_nonce, address=sender))
        except Exception:  # noqa: BLE001
            return None

    def wait(self, tx_hash, status: str = "ACCEPTED", retries: int = 100) -> dict:
        return retry(
            "wait", self.client.wait_for_transaction_receipt, transaction_hash=tx_hash,
            wait_until="finalized" if status == "FINALIZED" else "decided", interval=3000, retries=retries,
        )

    def send(self, address: str, method: str, args: list | None = None, value: int = 0,
             status: str = "ACCEPTED") -> dict:
        """Write, wait, and report honestly. A refusal comes back with ok False and the sentence."""
        tx = self.write(address, method, args, value)
        receipt = self.wait(tx, status)
        outcome = check(receipt)
        outcome["hash"] = _hash(tx)
        outcome["url"] = tx_url(outcome["hash"])
        return outcome


# --- reading a receipt honestly -------------------------------------------
def _hash(tx) -> str:
    if isinstance(tx, str):
        return tx
    return getattr(tx, "hex", lambda: str(tx))()


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
    if isinstance(raw, int) or str(raw).isdigit():
        return STATUS_NAMES.get(int(raw), f"STATUS_{raw}")
    return str(raw).upper()


def check(receipt) -> dict:
    """Success means ACCEPTED or FINALIZED AND the leader's execution returned."""
    if not isinstance(receipt, dict):
        return {"ok": False, "status": "?", "detail": str(receipt)[:300], "refusal": ""}
    status = receipt_status(receipt)
    consensus = receipt.get("consensus_data") or {}
    leader = consensus.get("leader_receipt") or [{}]
    if isinstance(leader, dict):
        leader = [leader]
    first = leader[0] if leader else {}
    execution = str(
        receipt.get("txExecutionResultName") or receipt.get("tx_execution_result_name")
        or first.get("execution_result", "")
    ).upper()
    outcome = first.get("result") or {}
    refusal = ""
    if isinstance(outcome, dict) and str(outcome.get("status", "")).lower() in ("rollback", "user_error"):
        payload = outcome.get("payload")
        refusal = payload if isinstance(payload, str) else str(payload)
    ok = status in SETTLED and execution in ("SUCCESS", "FINISHED_WITH_RETURN", "")
    detail = "" if ok else f"status={status} execution={execution} {refusal}".strip()
    votes = _find_key(receipt, ("votes", "validator_votes", "validatorVotes"))
    return {"ok": ok, "status": status, "execution": execution, "detail": detail,
            "refusal": refusal, "votes": votes}


# --- accounts and the deployment record ------------------------------------
def load_accounts(names: typing.Iterable[str]) -> dict:
    """Test accounts, created once and reused. Only addresses are ever printed."""
    raw = json.loads(KEYS.read_text(encoding="utf-8")) if KEYS.exists() else {}
    changed = False
    for name in names:
        if name not in raw:
            raw[name] = create_account().key.hex()
            changed = True
    if changed:
        KEYS.write_text(json.dumps(raw, indent=2) + "\n", encoding="utf-8")
    return {name: create_account(account_private_key=raw[name]) for name in names}


def load_deployment() -> dict:
    if not DEPLOYED.exists():
        raise SystemExit("deployed.json is missing. Run: python scripts/deploy.py")
    return json.loads(DEPLOYED.read_text(encoding="utf-8"))


def save_deployment(record: dict) -> None:
    DEPLOYED.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")
