#!/usr/bin/env python3
"""
Seed one realistic court so the site has something true to show: Kiln Discord,
with three rulings (overturned, reduced, upheld), one answer waiting on the
member's reply, and two appeals waiting at the moderator desk.

    python scripts/seed.py

Every number the site then shows comes from these transactions; nothing is
written to the page by hand.
"""

from __future__ import annotations

import json
import pathlib
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, HERE.as_posix())

from chain import GEN, Chain, load_accounts, load_deployment, tx_url  # noqa: E402

GOLDEN = json.loads((HERE.parent / "eval" / "golden.json").read_text(encoding="utf-8"))
BY_ID = {c["id"]: c for c in GOLDEN["cases"]}
JUDGED = ["1", "3", "2"]
ANSWERED = ["6"]
WAITING = [
    {"case_ref": "0xnadir (Discord 611203997140221952), banned in #general",
     "statement": "Caught in the raid purge. I was talking about the testnet in #general when everyone got banned."},
    {"case_ref": "pelle (Discord 288761930215604224), muted 7 days in #general",
     "statement": "It was a joke between friends and nobody complained."},
]


def main() -> None:
    contract = load_deployment()["contract"]
    names = ["seed_owner", "seed_mod"] + [f"seed_m{i}" for i in range(6)]
    accounts = load_accounts(names)
    owner = Chain(accounts["seed_owner"])
    for name in names:
        if owner.balance(accounts[name].address) < 5 * GEN:
            owner.fund(accounts[name].address, (150 if name == "seed_owner" else 20) * GEN)
    mod = Chain(accounts["seed_mod"])
    court = GOLDEN["court"]

    def send(chain: Chain, method: str, args: list, value: int = 0) -> None:
        out = chain.send(contract, method, args, value)
        print(f"  {method:10} {out['status']} {'ok' if out['ok'] else 'REFUSED ' + out['refusal']} {tx_url(out['hash'])}")
        if not out["ok"]:
            raise SystemExit(1)

    send(owner, "open_court", ["Kiln Discord", json.dumps(court["rules"]), json.dumps(court["ladder"]),
                               json.dumps([accounts["seed_mod"].address]), 2 * GEN, 5 * GEN, 48], 100 * GEN)
    court_id = owner.read_json(contract, "get_court", [0])["court_count"]
    today = time.strftime("%Y-%m-%d", time.gmtime())
    members = iter(Chain(accounts[f"seed_m{i}"]) for i in range(6))

    for cid in JUDGED + ANSWERED:
        case = BY_ID[cid]
        member = next(members)
        send(member, "appeal", [court_id, case["case_ref"], today, case["statement"]], 2 * GEN)
        appeal_id = member.read_json(contract, "list_appeals", [court_id, "", 0, 1])[0]["id"]
        send(mod, "respond", [appeal_id, case["rule"], case["level"], case["evidence"]])
        if cid in JUDGED:
            send(member, "reply", [appeal_id, case["reply"]])
            send(member, "judge", [appeal_id])
    for case in WAITING:
        send(next(members), "appeal", [court_id, case["case_ref"], today, case["statement"]], 2 * GEN)
    print(f"seeded court {court_id}")


if __name__ == "__main__":
    main()
