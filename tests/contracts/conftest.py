"""
Loads the REAL contract files against the doubles in genvm_double.py, as
Studionet's py-genlayer:1jb45aa8 runtime shapes the package (the star import
brings gl, Address, TreeMap and the integer types). Nothing is copied: a change
to contracts/*.py is a change to what these tests run.
"""

from __future__ import annotations

import importlib.util
import os
import pathlib
import sys
import types

import pytest

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

import genvm_double as D  # noqa: E402

OWNER = D.Address("0x" + "11" * 20)
STRANGER = D.Address("0x" + "22" * 20)


def _install(gl: D.GL) -> None:
    module = types.ModuleType("genlayer")
    module.gl = gl
    module.Address = D.Address
    module.TreeMap = D.TreeMap
    module.DynArray = D.DynArray
    module.allow_storage = D.allow_storage
    for name in ("u8", "u16", "u32", "u64", "u256"):
        setattr(module, name, getattr(D, name))
    module.__all__ = ["gl", "Address", "TreeMap", "DynArray", "allow_storage", "u8", "u16", "u32", "u64", "u256"]
    sys.modules["genlayer"] = module


class World:
    """One fresh runtime plus one deployed contract."""

    def __init__(self, file: str, cls: str) -> None:
        self.gl = D.GL()
        _install(self.gl)
        base = pathlib.Path(os.environ.get("ARCADE_CONTRACTS_DIR") or ROOT / "contracts")
        spec = importlib.util.spec_from_file_location(f"arcade_{cls}", base / file)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.mod = mod
        self.gl.message.sender_address = OWNER
        self.c = getattr(mod, cls)()
        self.gl.message.raw["is_init"] = False

    def as_(self, who: D.Address) -> "World":
        self.gl.message.sender_address = who
        return self

    @property
    def leader(self) -> D.NodeWorld:
        return self.gl.nondet.leader

    def validators(self, n: int) -> list[D.NodeWorld]:
        self.gl.nondet.validators = [D.NodeWorld(f"validator{i}") for i in range(n)]
        return self.gl.nondet.validators


@pytest.fixture
def verdict() -> World:
    return World("daily_verdict.py", "DailyVerdict")


@pytest.fixture
def bridge() -> World:
    return World("word_bridge.py", "WordBridge")


@pytest.fixture
def oracle() -> World:
    return World("oracle_guess.py", "OracleGuess")


@pytest.fixture
def ledger() -> World:
    return World("season_ledger.py", "SeasonLedger")
