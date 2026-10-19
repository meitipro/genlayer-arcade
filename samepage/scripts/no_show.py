"""
Settle the seeded no-show page once its window has closed.

    python scripts/no_show.py settle

A fresh account that is neither side calls no_show: the rule decides who was
absent from what is on chain, so who calls it changes nothing. The page and
both sides' balances inside the contract are read back and recorded.
"""

from __future__ import annotations

import json
import sys
import time

from chain import GEN, ROOT, Chain, current_address, fresh, save_json, tx_url

SEED = ROOT / "chain" / "out" / "seed.json"
OUT = ROOT / "chain" / "out" / "no-show.json"


def main(argv: list[str]) -> int:
    address = current_address()
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    page = seed["noshow"]["id"]
    reader = Chain()
    before = reader.read_json(address, "get_page", [page])
    present, absent = seed["noshow"]["present"], seed["noshow"]["absent"]
    balance_before = {who: reader.read_json(address, "list_pages", [who, 0, 1])["balance"] for who in (present, absent)}
    wait = before["deadline"] - int(time.time())
    if wait > 0:
        print(f"page #{page} window closes in {wait} s; nothing to settle yet")
        return 1
    caller = fresh("settler")
    chain = Chain(caller)
    chain.fund(caller.address, 20 * GEN)
    early = None
    outcome = chain.send(address, "no_show", [page])
    after = reader.read_json(address, "get_page", [page])
    balance_after = {who: reader.read_json(address, "list_pages", [who, 0, 1])["balance"] for who in (present, absent)}
    again = chain.send(address, "no_show", [page], expect_refusal=True)
    record = {
        "page": page,
        "settled_by": caller.address,
        "tx": outcome["hash"],
        "url": tx_url(outcome["hash"]),
        "step_before": before["step"],
        "step_after": after["step"],
        "absent": after["absent"],
        "balance_before": balance_before,
        "balance_after": balance_after,
        "second_call_refused": again["refusal"],
        "second_call_tx": again["hash"],
        "early": early,
    }
    save_json(OUT, record)
    print(json.dumps(record, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
