"""
The steps of one page, as the two sides take them, shared by the golden run,
the reviewer's path and the seed. Each step returns its checked outcome with
the transaction hash, so every caller can publish what actually happened.
"""

from __future__ import annotations

from chain import Chain, new_salt, seal_of


class Side:
    """One side of a page: an account, its chain client, and its tickets."""

    def __init__(self, label: str, account):
        self.label = label
        self.account = account
        self.chain = Chain(account)
        #: round -> (text, salt), the ticket the browser would keep.
        self.tickets: dict[int, tuple[str, str]] = {}

    @property
    def address(self) -> str:
        return self.account.address


def open_page(side: Side, address: str, title: str, other: str, deposit: int, hours: int) -> tuple[int, dict]:
    outcome = side.chain.send(address, "open_page", [title, other, deposit, hours], value=deposit)
    page = outcome["result"]
    if not isinstance(page, int):
        # Older receipts may not carry the return value; the newest page of the opener is it.
        listing = side.chain.read_json(address, "list_pages", [side.address, 0, 1])
        page = listing["pages"][0]["id"]
    return int(page), outcome


def join(side: Side, address: str, page: int, deposit: int) -> dict:
    return side.chain.send(address, "join", [page], value=deposit)


def seal(side: Side, address: str, page: int, round_no: int, text: str) -> dict:
    salt = new_salt()
    side.tickets[round_no] = (text, salt)
    return side.chain.send(address, "seal", [page, seal_of(text, salt, side.address)])


def reveal(side: Side, address: str, page: int, round_no: int) -> dict:
    text, salt = side.tickets[round_no]
    return side.chain.send(address, "reveal", [page, text, salt])


def check(caller: Side, address: str, page: int) -> dict:
    return caller.chain.send(address, "check", [page])


def write_round(a: Side, b: Side, address: str, page: int, round_no: int, a_text: str, b_text: str) -> dict:
    """Both seal, then both open. Returns the four outcomes by step."""
    return {
        "seal_a": seal(a, address, page, round_no, a_text),
        "seal_b": seal(b, address, page, round_no, b_text),
        "reveal_a": reveal(a, address, page, round_no),
        "reveal_b": reveal(b, address, page, round_no),
    }


def tx(outcome: dict) -> str:
    return outcome["hash"]
