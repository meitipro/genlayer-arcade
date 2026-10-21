"""
Loads the REAL contracts/unban.py against the double in genvm_double.py.

Nothing is copied or re-implemented: the file is imported as ordinary Python
behind a `genlayer` module shaped like py-genlayer:5jycge4q (the star import
gives Address and the integer types; `gl` is the package itself; the storage
names live in genlayer.storage), so an import the runtime does not provide
fails here rather than on chain.
"""

from __future__ import annotations

import importlib.util
import json
import pathlib
import sys
import types

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CONTRACT = ROOT / "contracts" / "unban.py"

sys.path.insert(0, str(HERE))

import genvm_double as D  # noqa: E402

GEN = 10**18
DAY = 86400
HOUR = 3600


def _install(gl: D.GL) -> None:
    sys.modules.pop("genlayer.storage", None)
    module = types.ModuleType("genlayer")
    storage = types.ModuleType("genlayer.storage")
    storage.DynArray = D.DynArray
    storage.TreeMap = D.TreeMap
    storage.allow = D.allow_storage
    module.Address = D.Address
    module.u8 = D.u8
    module.u32 = D.u32
    module.u64 = D.u64
    module.u256 = D.u256
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
    spec = importlib.util.spec_from_file_location("unban_contract", CONTRACT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


# The Kiln court from the spec: five rules, a four-step ladder ending in a ban.
KILN_RULES = [
    {"text": "No insults or harassment of other members.", "first": "P3", "repeat": "P4"},
    {"text": "No scam or phishing links.", "first": "P4", "repeat": "P4"},
    {"text": "No spam: no flooding the channel with repeated messages.", "first": "P2", "repeat": "P4"},
    {"text": "No price talk outside #trading.", "first": "P1", "repeat": "P2"},
    {"text": "No impersonating the team or moderators.", "first": "P4", "repeat": "P4"},
]
KILN_LADDER = ["warning", "24h mute", "7-day mute", "ban"]


class World:
    """One contract, the accounts around it, and an explicit clock."""

    OWNER = "0x" + "a1" * 20
    MOD = "0x" + "b2" * 20
    MEMBER = "0x" + "c3" * 20
    OTHER = "0x" + "d4" * 20
    STRANGER = "0x" + "e5" * 20
    CONTRACT = "0x" + "cc" * 20

    def __init__(self) -> None:
        self.gl = D.GL()
        self.t = 1791000000  # 2026-10-03T03:20:00Z
        self.at(self.t)
        self.mod = load(self.gl)
        self.gl.bus.current = D.Address(self.CONTRACT)
        self.gl.message.contract_address = D.Address(self.CONTRACT)
        self.sender(self.OWNER)
        self.c = self.mod.Unban()

    # -- environment -------------------------------------------------------

    def at(self, seconds: int) -> None:
        self.t = seconds
        import datetime

        moment = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc) + datetime.timedelta(seconds=seconds)
        self.gl.message_raw["datetime"] = moment.strftime("%Y-%m-%dT%H:%M:%SZ")

    def later(self, seconds: int) -> None:
        self.at(self.t + seconds)

    def today(self, offset_days: int = 0) -> str:
        import datetime

        moment = datetime.datetime(1970, 1, 1) + datetime.timedelta(seconds=self.t + offset_days * DAY)
        return moment.strftime("%Y-%m-%d")

    def sender(self, address: str, value: int = 0) -> None:
        self.gl.message.sender_address = D.Address(address)
        self.gl.message.origin_address = D.Address(address)
        self.gl.message.value = value

    def model(self, *answers) -> None:
        """Queue model answers; the leader and each validator run take one each."""
        for answer in answers:
            self.gl.nondet.answers.append(answer if isinstance(answer, (str, Exception)) else json.dumps(answer))

    # -- calls ---------------------------------------------------------------

    def open_court(self, pool: int = 100 * GEN, fee: int = 2 * GEN, comp: int = 5 * GEN, hours: int = 48,
                   rules=None, ladder=None, mods=None, name: str = "Kiln Discord", owner: str | None = None) -> int:
        self.sender(owner or self.OWNER, pool)
        self.c.open_court(
            name,
            json.dumps(rules if rules is not None else KILN_RULES),
            json.dumps(ladder if ladder is not None else KILN_LADDER),
            json.dumps(mods if mods is not None else [self.MOD]),
            fee,
            comp,
            hours,
        )
        return int(self.c.court_count)

    def appeal(self, court_id: int = 1, member: str | None = None, case: str = "ardal on Discord, banned Oct 3",
               statement: str = "I asked when the unlock starts and was banned for FUD.", fee: int = 2 * GEN,
               banned_on: str | None = None) -> int:
        self.sender(member or self.MEMBER, fee)
        self.c.appeal(court_id, case, banned_on or self.today(), statement)
        return int(self.c.appeal_count)

    def respond(self, appeal_id: int = 1, rule: int = 1, level: str = "P4",
                evidence: str = "[14:02] ardal: when does the team unlock start? the docs say Q4",
                mod: str | None = None) -> None:
        self.sender(mod or self.MOD)
        self.c.respond(appeal_id, rule, level, evidence)

    def reply(self, appeal_id: int = 1, text: str = "Rule 1 is about insults. A question is neither.",
              member: str | None = None) -> None:
        self.sender(member or self.MEMBER)
        self.c.reply(appeal_id, text)

    def judge(self, appeal_id: int = 1, caller: str | None = None) -> None:
        self.sender(caller or self.STRANGER)
        self.c.judge(appeal_id)

    def court(self, court_id: int = 1) -> dict:
        return json.loads(self.c.get_court(court_id))

    def appeal_row(self, appeal_id: int = 1) -> dict:
        return json.loads(self.c.get_appeal(appeal_id))

    def balance(self, address: str) -> int:
        return int(self.c.balances.get(D.Address(address), 0))

    def solvent(self) -> None:
        """
        held equals every pool, every reserve, every balance and the fee of
        every open appeal, nothing is negative, and each court's reserve is
        exactly the reserves of its open appeals.
        """
        total = 0
        open_reserves: dict[int, int] = {}
        for appeal in self.c.appeals.values():
            if appeal.status in ("FILED", "ANSWERED"):
                total += int(appeal.fee)
                key = int(appeal.court_id)
                open_reserves[key] = open_reserves.get(key, 0) + int(appeal.reserved)
        for court_id, court in self.c.courts.items():
            assert int(court.pool) >= 0 and int(court.reserved) >= 0
            assert int(court.reserved) == open_reserves.get(int(court_id), 0)
            total += int(court.pool) + int(court.reserved)
        for value in self.c.balances.values():
            assert int(value) >= 0
            total += int(value)
        assert total == int(self.c.held), (total, int(self.c.held))
