"""
A thin double of the `genlayer` names unban.py touches, for direct tests.

It proves the contract's own logic: guards, windows, the reserve and the
settlement table. It does NOT prove anything about GenVM storage or consensus;
genvm-lint validates the file against the real SDK, and eval/ measures the
judge through real consensus.
"""

from __future__ import annotations

import typing


class UserError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class Return:
    def __init__(self, value: typing.Any) -> None:
        self.calldata = value


class Address:
    """20 raw bytes. Compares case-insensitively, as a node does."""

    def __init__(self, value: typing.Any) -> None:
        text = str(value).strip()
        if not text.startswith("0x") or len(text) != 42:
            raise ValueError(f"not an address: {text}")
        int(text[2:], 16)
        self._hex = text

    @property
    def as_hex(self) -> str:
        return self._hex

    def __eq__(self, other: typing.Any) -> bool:
        return isinstance(other, Address) and other._hex.lower() == self._hex.lower()

    def __ne__(self, other: typing.Any) -> bool:
        return not self.__eq__(other)

    def __hash__(self) -> int:
        return hash(self._hex.lower())

    def __repr__(self) -> str:
        return f"Address({self._hex})"


def _sized(bits: int):
    limit = 1 << bits

    def make(value: typing.Any = 0) -> int:
        number = int(value)
        if number < 0 or number >= limit:
            raise OverflowError(f"u{bits} out of range: {number}")
        return number

    return make


u8 = _sized(8)
u64 = _sized(64)
u256 = _sized(256)
i64 = int


class _Write:
    def __init__(self, surface: "_Public") -> None:
        self._surface = surface

    def __call__(self, fn):
        self._surface.writes.append(fn.__name__)
        return fn

    def payable(self, fn):
        self._surface.writes.append(fn.__name__)
        self._surface.payables.append(fn.__name__)
        return fn


class _Public:
    def __init__(self) -> None:
        self.writes: list[str] = []
        self.views: list[str] = []
        self.payables: list[str] = []
        self.write = _Write(self)

    def view(self, fn):
        self.views.append(fn.__name__)
        return fn


class Bus:
    """What the contract did that a test wants to read back."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.transfers: list[tuple[str, int]] = []
        self.prompts: list[str] = []
        self.answers: list[typing.Any] = []
        self.validator_answers: list[typing.Any] | None = None
        self.votes: list[bool] = []


bus = Bus()


class _Vm:
    UserError = UserError
    Return = Return

    def run_nondet(self, leader_fn, validator_fn):
        """One leader run, then one validator run against it. False is a disagree."""
        try:
            leader: typing.Any = Return(leader_fn())
        except UserError as error:
            leader = error
        if bus.validator_answers is not None:
            bus.answers = list(bus.validator_answers)
        agreed = validator_fn(leader)
        bus.votes.append(bool(agreed))
        if not agreed:
            raise UserError("[DISAGREE] validator disagreed")
        if isinstance(leader, Return):
            return leader.calldata
        raise leader


class _Nondet:
    def exec_prompt(self, prompt: str, **_kwargs) -> str:
        bus.prompts.append(prompt)
        if not bus.answers:
            raise AssertionError("the test gave the model no answer")
        return bus.answers.pop(0)


class _Message:
    def __init__(self) -> None:
        self.sender_address = Address("0x" + "11" * 20)
        self.value = 0
        self.raw = {"datetime": "2026-10-01T12:00:00Z"}


class _Contract:
    pass


class _ContractNs:
    Contract = _Contract


class _Evm:
    @staticmethod
    def contract_interface(cls):
        class Proxy:
            def __init__(self, address: Address) -> None:
                self._to = address

            def emit_transfer(self, value: int = 0, **_kwargs) -> None:
                bus.transfers.append((self._to.as_hex.lower(), int(value)))

        Proxy.__name__ = cls.__name__
        return Proxy


public = _Public()
vm = _Vm()
nondet = _Nondet()
message = _Message()
contract = _ContractNs()
evm = _Evm()


class _Gl:
    """So `gl.x` works whether the contract imports gl or genlayer as gl."""

    public = public
    vm = vm
    nondet = nondet
    message = message
    contract = contract
    evm = evm


gl = _Gl()

__all__ = ["Address", "u8", "u64", "u256", "i64", "gl"]
