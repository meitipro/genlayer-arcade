"""
A test double for the parts of `genlayer` the GenLayer Arcade contracts touch.
Carried over from Keepalive (same author), with one change marked below.

WHAT THIS PROVES, AND WHAT IT DOES NOT.

It proves the contract's own logic: which guard fires first, what a method
writes, how a period moves between states, whether a refusal is the sentence it
should be, and whether the pool moves the right money to the right party.

It does NOT prove anything about GenVM. Storage here is plain Python objects,
so it says nothing about slot layout, calldata encoding or consensus. A test
passing here and a transaction succeeding on chain are different claims.
Consensus behaviour is measured by eval/ and by the gated integration test.

It exists because genlayer-test downloads a GenVM binary that has no Windows
build, so without it none of the contract logic could run on this machine.

Two rules from past rejections are modelled on purpose:
  - Each node has its own world. The leader and every validator read their own
    pages and their own model answers, because a contract that quietly assumes
    both see identical bytes passes a shared-mock suite and fails on a network.
  - Addresses compare as twenty bytes, never as case-sensitive strings.
"""

from __future__ import annotations

import typing


class UserError(Exception):
    """`gl.vm.UserError`. v0.3 carries the payload as `.data`; `.message` is kept for the old name."""

    def __init__(self, data: typing.Any) -> None:
        super().__init__(data)
        self.data = data
        self.message = data if isinstance(data, str) else str(data)

    def __str__(self) -> str:
        return self.message


class VMError(Exception):
    """A VM level failure: a disagreement, an encoder refusal, a nondet call outside a block."""

    def __init__(self, message: str = "") -> None:
        super().__init__(message)
        self.message = message


class Return:
    """`gl.vm.Return`. Wraps a leader result that came back successfully."""

    def __init__(self, value: typing.Any) -> None:
        self.calldata = value


class Address:
    """A 20 byte address. Compares by value, case-insensitively, as raw bytes would."""

    def __init__(self, value: typing.Any) -> None:
        text = value.as_hex if isinstance(value, Address) else str(value).strip()
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
            raise ValueError(f"u{bits} out of range: {number}")
        return number

    make.__name__ = f"u{bits}"
    return make


u8 = _sized(8)
u16 = _sized(16)
u32 = _sized(32)
u64 = _sized(64)
u256 = _sized(256)


class NondetGuard:
    """Whether a non-deterministic block is running, shared by storage and gl.nondet."""

    active = False


class GuardedMap(dict):
    """
    A TreeMap. Storage is unreachable from inside a non-deterministic block on a
    node, so touching one from inside a block fails here too.
    """

    def _guard(self) -> None:
        if NondetGuard.active:
            raise VMError("storage is not accessible from a non-deterministic block")

    def __getitem__(self, key):
        self._guard()
        return super().__getitem__(key)

    def __contains__(self, key) -> bool:
        self._guard()
        return super().__contains__(key)

    def get(self, key, default=None):
        self._guard()
        return super().get(key, default)


class _Generic:
    """Makes `TreeMap[str, Stream]` a valid annotation and a factory for an empty one."""

    def __init__(self, empty) -> None:
        self._empty = empty

    def __getitem__(self, _item) -> "_Generic":
        return self

    def empty(self):
        return self._empty()


DynArray = _Generic(list)
TreeMap = _Generic(GuardedMap)


def allow_storage(cls):
    return cls


class _Write:
    """`@gl.public.write` and `@gl.public.write.payable`."""

    def __init__(self, surface: "_Public") -> None:
        self._surface = surface

    def __call__(self, fn):
        self._surface.writes.append(fn.__name__)
        fn.__gl_kind__ = "write"
        return fn

    def payable(self, fn):
        self._surface.writes.append(fn.__name__)
        self._surface.payables.append(fn.__name__)
        fn.__gl_kind__ = "payable"
        return fn


class _Public:
    def __init__(self) -> None:
        self.writes: list[str] = []
        self.views: list[str] = []
        self.payables: list[str] = []
        self.write = _Write(self)

    def view(self, fn):
        self.views.append(fn.__name__)
        fn.__gl_kind__ = "view"
        return fn


class Response:
    """`gl.nondet.web.Response`."""

    def __init__(self, status: int, body: bytes | None) -> None:
        self.status = status
        self.headers: dict = {}
        self.body = body


class NodeWorld:
    """
    What one node sees: its own pages, its own API answers, its own model
    answers. A page may be an Exception, which is raised from the fetch.
    """

    def __init__(self, name: str) -> None:
        self.name = name
        self.pages: dict[str, typing.Any] = {}
        self.api: dict[str, tuple[int, str]] = {}
        self.answers: list[typing.Any] = []
        self.prompts: list[str] = []
        self.fetched: list[str] = []
        self.default_page = "Nothing on this page mentions any work."

    def page(self, url: str):
        self.fetched.append(url)
        value = self.pages.get(url, self.default_page)
        if isinstance(value, Exception):
            raise value
        return value


class _Web:
    def __init__(self, nondet: "_Nondet") -> None:
        self._nondet = nondet

    def render(self, url: str, *, mode: str = "text", wait_after_loaded=None) -> str:
        world = self._nondet.world()
        if mode != "text":
            raise AssertionError("the contract reads pages in text mode only")
        return world.page(url)

    def get(self, url: str, *, headers=None, sign: bool = False) -> Response:
        world = self._nondet.world()
        world.fetched.append(url)
        status, body = world.api.get(url, (200, "[]"))
        if isinstance(body, Exception):
            raise body
        return Response(status, body.encode("utf-8"))


class _Nondet:
    """`gl.nondet`. Every call must come from inside a non-deterministic block."""

    def __init__(self) -> None:
        self.leader = NodeWorld("leader")
        self.validators = [NodeWorld("validator")]
        self.role: NodeWorld | None = None
        self.web = _Web(self)

    def world(self) -> NodeWorld:
        if self.role is None:
            raise VMError("not reachable from equivalence principle block")
        return self.role

    def exec_prompt(self, prompt: str, **_config) -> typing.Any:
        world = self.world()
        world.prompts.append(prompt)
        if not world.answers:
            raise AssertionError(f"no model answer queued for the {world.name}")
        answer = world.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


class _Vm:
    UserError = UserError
    VMError = VMError
    Return = Return

    def __init__(self, bus: "Bus", nondet: _Nondet) -> None:
        self._bus = bus
        self._nondet = nondet

    def run_nondet(self, leader_fn, validator_fn, **_options):
        """
        The leader runs in its own world, then each validator runs the
        validator function in its own world against the leader's result. Any
        validator voting False, or raising, is a disagreement, which terminates
        the VM on a node, so it is raised here.

        Keepalive's double required a flat dict of strings from the leader.
        The Arcade contracts return {"score": int, "reason": str}, a list of
        bools and a bare int, and all three were measured to encode and settle
        on Studionet (docs/studio-tests.studionet.json), so this double accepts
        any calldata-encodable value: str, int, bool, None, list, dict.
        """
        self._bus.nondet_runs += 1
        NondetGuard.active = True
        try:
            self._nondet.role = self._nondet.leader
            try:
                value = leader_fn()
                leader_result: typing.Any = Return(value)
            except UserError as error:
                leader_result = error
            if isinstance(leader_result, Return) and not _encodable(leader_result.calldata):
                raise VMError("calldata encoder: value is not calldata-encodable")
            votes = []
            for world in self._nondet.validators:
                self._nondet.role = world
                try:
                    votes.append(bool(validator_fn(leader_result)))
                except Exception:  # noqa: BLE001  an error in the validator is a disagreement
                    votes.append(False)
            self._bus.validator_votes.append(votes)
        finally:
            self._nondet.role = None
            NondetGuard.active = False
        if not all(votes):
            raise VMError("validator disagreed")
        if isinstance(leader_result, Return):
            return leader_result.calldata
        raise leader_result


def _encodable(v) -> bool:
    if v is None or isinstance(v, (str, bool, int)):
        return True
    if isinstance(v, list):
        return all(_encodable(x) for x in v)
    if isinstance(v, dict):
        return all(isinstance(k, str) and _encodable(x) for k, x in v.items())
    return False


class _Message:
    """Mutable, so a test can act as different senders and send value."""

    def __init__(self) -> None:
        self.sender_address = Address("0x" + "11" * 20)
        self.origin_address = Address("0x" + "11" * 20)
        self.contract_address = Address("0x" + "cc" * 20)
        self.value = 0
        self.chain_id = 61997
        self.raw: dict = {"datetime": "2026-09-01T00:00:00Z", "is_init": False}


class Transfer(typing.NamedTuple):
    to: str
    value: int


class Bus:
    """Everything that leaves the contract."""

    def __init__(self) -> None:
        self.transfers: list[Transfer] = []
        self.nondet_runs = 0
        self.validator_votes: list[list[bool]] = []


class _Evm:
    """`gl.evm.contract_interface`, the external message form used for payouts."""

    def __init__(self, bus: Bus) -> None:
        self._bus = bus

    def contract_interface(self, declaration):
        bus = self._bus

        class Proxy:
            def __init__(self, address: Address) -> None:
                self.address = address

            def emit_transfer(self, *, value: int) -> None:
                if NondetGuard.active:
                    raise VMError("messages cannot be sent from a non-deterministic block")
                if int(value) <= 0:
                    raise ValueError("value is zero")
                bus.transfers.append(Transfer(self.address.as_hex, int(value)))

        Proxy.__name__ = getattr(declaration, "__name__", "Proxy")
        return Proxy


class Contract:
    """
    Base class. Zero-initialises annotated storage fields the way GenVM does, so
    a constructor that never assigns a map still has one.
    """

    def __new__(cls, *args, **kwargs):
        instance = super().__new__(cls)
        for name, annotation in getattr(cls, "__annotations__", {}).items():
            if isinstance(annotation, _Generic):
                setattr(instance, name, annotation.empty())
            elif annotation is str:
                setattr(instance, name, "")
            elif annotation is bool:
                setattr(instance, name, False)
            else:
                setattr(instance, name, 0)
        return instance


class _Namespace:
    def __init__(self, **names: typing.Any) -> None:
        self.__dict__.update(names)


class GL:
    """The `genlayer` package as the contract imports it: `import genlayer as gl`."""

    def __init__(self) -> None:
        self.bus = Bus()
        self.nondet = _Nondet()
        self.vm = _Vm(self.bus, self.nondet)
        self.public = _Public()
        self.message = _Message()
        self.evm = _Evm(self.bus)
        self.contract = _Namespace(Contract=Contract)
        # The v0.2 names Studionet's runtime uses for the same things. Each is
        # the object above under its old name, never a second implementation:
        # message_raw is the same dict, so moving the clock moves it for both.
        self.Contract = Contract
        self.message_raw = self.message.raw
        self.vm.run_nondet_unsafe = self.vm.run_nondet
