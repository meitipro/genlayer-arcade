"""
Loads the REAL contract file against the doubles in genvm_double.py.

Nothing is copied or re-implemented here, so a change to contracts/samepage.py
is a change to what these tests exercise. The magic comment on line two is a
runner declaration and CPython ignores it, so the file imports as ordinary
Python.
"""

from __future__ import annotations

import datetime
import importlib.util
import json
import pathlib
import sys
import types

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
import os

#: scripts/mutate.py points this at a mutated copy; everything else reads the real file.
CONTRACT = pathlib.Path(os.environ.get("SAMEPAGE_CONTRACT", ROOT / "contracts" / "samepage.py"))

sys.path.insert(0, str(HERE))

import genvm_double as D  # noqa: E402

GEN = 10**18


def _install(gl: D.GL) -> None:
    """
    Publish a `genlayer` module shaped like py-genlayer:5jycge4q: the star
    import brings Address and the integer types, `gl` is the package itself,
    and the storage names live in genlayer.storage.
    """
    sys.modules.pop("genlayer.storage", None)
    module = types.ModuleType("genlayer")
    module.Address = D.Address
    module.u8 = D.u8
    module.u32 = D.u32
    module.u64 = D.u64
    module.u256 = D.u256
    storage = types.ModuleType("genlayer.storage")
    storage.DynArray = D.DynArray
    storage.TreeMap = D.TreeMap
    storage.allow = D.allow_storage
    for name in ("contract", "vm", "message", "public", "nondet", "evm"):
        setattr(module, name, getattr(gl, name))
    module.storage = storage
    module.__all__ = [
        "contract", "vm", "message", "public", "nondet", "evm", "storage",
        "Address", "u8", "u32", "u64", "u256",
    ]
    sys.modules["genlayer"] = module
    sys.modules["genlayer.storage"] = storage


def load(gl: D.GL) -> types.ModuleType:
    _install(gl)
    spec = importlib.util.spec_from_file_location("samepage_contract", CONTRACT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def answer(**statuses) -> str:
    """A model answer: every term MATCH unless named, plus a note per term."""
    terms = ["amount", "deliverable", "deadline", "payment", "rights", "cancellation"]
    body = {t: statuses.get(t, "MATCH") for t in terms}
    body["notes"] = {t: f"both on {t}" for t in terms}
    return json.dumps(body)


class World:
    """
    One Samepage contract and the accounts around it. Time is explicit:
    `at(seconds)` sets the transaction datetime the contract reads, because a
    window that closes is what most of these tests need to control.
    """

    KILN = "0x" + "a1" * 20
    SERA = "0x" + "b2" * 20
    STRANGER = "0x" + "c3" * 20
    CONTRACT = "0x" + "cc" * 20

    def __init__(self) -> None:
        self.gl = D.GL()
        self.t = 1791000000
        self.at(self.t)
        self.mod = load(self.gl)
        self.sender(self.KILN)
        self.c = self.mod.Samepage()
        self.gl.bus.register(self.CONTRACT, self.c)
        self.paid_in = 0

    # -- controls ----------------------------------------------------------

    def at(self, seconds: int) -> "World":
        self.t = seconds
        stamp = datetime.datetime.fromtimestamp(seconds, datetime.timezone.utc)
        self.gl.message_raw["datetime"] = stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        return self

    def advance(self, seconds: int) -> "World":
        return self.at(self.t + seconds)

    def sender(self, address: str, value: int = 0) -> "World":
        self.gl.message.sender_address = D.Address(address)
        self.gl.message.origin_address = D.Address(address)
        self.gl.message.contract_address = D.Address(self.CONTRACT)
        self.gl.bus.current = D.Address(self.CONTRACT)
        self.gl.message.value = D.u256(value)
        return self

    # -- shorthands --------------------------------------------------------

    def open(self, deposit: int = 20 * GEN, hours: int = 48, title: str = "Kiln launch posts",
             who: str | None = None, other: str | None = None) -> int:
        self.sender(who or self.KILN, deposit)
        page = self.c.open_page(title, other or self.SERA, deposit, hours)
        self.paid_in += deposit
        return page

    def join(self, page: int, deposit: int = 20 * GEN, who: str | None = None) -> None:
        self.sender(who or self.SERA, deposit)
        self.c.join(page)
        self.paid_in += deposit

    def seal(self, page: int, who: str, text: str, salt: str) -> str:
        value = self.mod.seal_of(text, salt, who)
        self.sender(who)
        self.c.seal(page, value)
        return value

    def reveal(self, page: int, who: str, text: str, salt: str) -> None:
        self.sender(who)
        self.c.reveal(page, text, salt)

    def write_round(self, page: int, a: str = "A account", b: str = "B account") -> None:
        self.seal(page, self.KILN, a, "aa" * 8)
        self.seal(page, self.SERA, b, "bb" * 8)
        self.reveal(page, self.KILN, a, "aa" * 8)
        self.reveal(page, self.SERA, b, "bb" * 8)

    def check(self, page: int, *answers: str, who: str | None = None) -> None:
        """Queue the model's answers, leader then validator, both orders each."""
        self.gl.nondet.answers.extend(answers)
        self.sender(who or self.STRANGER)
        self.c.check(page)

    def page(self, page: int) -> dict:
        return json.loads(self.c.get_page(page))

    def listing(self, address: str, offset: int = 0, limit: int = 50) -> dict:
        return json.loads(self.c.list_pages(address, offset, limit))

    def balance(self, address: str) -> int:
        return int(self.listing(address)["balance"])

    def withdraw(self, who: str) -> int:
        before = sum(t.value for t in self.gl.bus.transfers)
        self.sender(who)
        self.c.withdraw()
        return sum(t.value for t in self.gl.bus.transfers) - before

    # -- invariants --------------------------------------------------------

    def check_invariants(self) -> None:
        """
        Deposits always add up: everything paid in is either held or paid out,
        and held is exactly the live deposits plus every balance.
        """
        paid_out = sum(t.value for t in self.gl.bus.transfers)
        assert int(self.c.held) + paid_out == self.paid_in, "money is neither held nor paid out"
        live = 0
        everyone = json.loads(self.c.list_pages("0x" + "0" * 40, 0, 50))["pages"]
        for row in everyone:
            if row["step"] == "JOINING":
                live += int(row["deposit"])
            elif row["step"] in ("SEALING", "OPENING", "CHECKING", "SIGNING"):
                live += 2 * int(row["deposit"])
        balances = sum(int(v) for v in self.c.balances.values())
        assert int(self.c.held) == live + balances, (
            f"held {int(self.c.held)} != live {live} + balances {balances}"
        )


def raises(fragment: str, fn, *args, **kwargs) -> str:
    """Assert the call is refused with the [EXPECTED] sentence that names it."""
    try:
        fn(*args, **kwargs)
    except D.UserError as error:
        message = str(error)
        assert message.startswith("[EXPECTED] "), f"unprefixed refusal: {message}"
        assert fragment in message, f"expected {fragment!r}, got {message!r}"
        return message
    raise AssertionError(f"expected a refusal containing {fragment!r}, nothing was raised")
