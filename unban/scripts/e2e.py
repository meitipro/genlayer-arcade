#!/usr/bin/env python3
"""
The reviewer's path, end to end, on Studio Next, with an explorer link for
every step. Writes eval/e2e.json and eval/e2e.md from what the chain returned.

    python scripts/e2e.py

1. the owner opens a court with five rules, a four-step ladder and 100 GEN
2. a member appeals with the exact 2 GEN fee (5 GEN is reserved)
3. a stranger tries to answer as a moderator and is refused, on chain
4. the listed moderator answers: rule 1, P4 ban, the quoted messages
5. the member replies once
6. a third party calls judge; validators rule
7. the appeal is read back: verdict, reason, the member's balance
8. the member withdraws; the balance is read before and after
"""

from __future__ import annotations

import json
import pathlib
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, HERE.as_posix())

from chain import GEN, Chain, address_url, load_accounts, load_deployment, tx_url  # noqa: E402

ROOT = HERE.parent
GOLDEN = json.loads((ROOT / "eval" / "golden.json").read_text(encoding="utf-8"))
CASE = GOLDEN["cases"][0]


def main() -> None:
    contract = load_deployment()["contract"]
    accounts = load_accounts(["e2e_owner", "e2e_mod", "e2e_member", "e2e_stranger"])
    owner = Chain(accounts["e2e_owner"])
    for name, amount in (("e2e_owner", 150), ("e2e_mod", 10), ("e2e_member", 20), ("e2e_stranger", 10)):
        if owner.balance(accounts[name].address) < 5 * GEN:
            owner.fund(accounts[name].address, amount * GEN)
    member, mod, stranger = Chain(accounts["e2e_member"]), Chain(accounts["e2e_mod"]), Chain(accounts["e2e_stranger"])
    steps: list[dict] = []

    def record(label: str, outcome: dict, expect_ok: bool = True, note: str = "") -> dict:
        passed = outcome["ok"] == expect_ok
        row = {"step": label, "pass": passed, "status": outcome["status"], "ok": outcome["ok"],
               "refusal": outcome.get("refusal", ""), "tx": outcome["hash"], "url": outcome["url"], "note": note}
        steps.append(row)
        print(f"{'PASS' if passed else 'FAIL'}  {label}: {outcome['status']} {outcome.get('refusal', '')} {outcome['url']}")
        return row

    court = GOLDEN["court"]
    record("open_court with 100 GEN", owner.send(contract, "open_court", [
        "Kiln Discord", json.dumps(court["rules"]), json.dumps(court["ladder"]),
        json.dumps([accounts["e2e_mod"].address]), 2 * GEN, 5 * GEN, 48], 100 * GEN))
    court_id = owner.read_json(contract, "get_court", [0])["court_count"]

    today = time.strftime("%Y-%m-%d", time.gmtime())
    record("appeal with the 2 GEN fee", member.send(contract, "appeal", [court_id, CASE["case_ref"], today, CASE["statement"]], 2 * GEN))
    appeal_id = member.read_json(contract, "list_appeals", [court_id, "", 0, 1])[0]["id"]
    reserved = member.read_json(contract, "get_appeal", [appeal_id])["reserved"]

    record("a stranger answers as a moderator (must be refused)",
           stranger.send(contract, "respond", [appeal_id, 1, "P4", "made up"]), expect_ok=False)
    record("moderator answers: rule 1, P4, quoted messages",
           mod.send(contract, "respond", [appeal_id, CASE["rule"], CASE["level"], CASE["evidence"]]))
    record("member replies once", member.send(contract, "reply", [appeal_id, CASE["reply"]]))
    judged = record("a third party calls judge", stranger.send(contract, "judge", [appeal_id]))

    row = member.read_json(contract, "get_appeal", [appeal_id])
    verdict_ok = row["status"] == "OVERTURNED" and int(row["member_balance"]) == 7 * GEN
    steps.append({"step": "read back the ruling", "pass": verdict_ok, "status": row["status"],
                  "note": f"{row['status']}: {row['reason']} member balance {int(row['member_balance']) / GEN:g} GEN"})
    print(f"{'PASS' if verdict_ok else 'FAIL'}  ruling {row['status']}: {row['reason']}")

    before = member.balance(accounts["e2e_member"].address)
    withdrawn = record("member withdraws", member.send(contract, "withdraw", [0], status="FINALIZED"))
    after = member.balance(accounts["e2e_member"].address)
    withdrawn["note"] = f"wallet {before / GEN:.4f} -> {after / GEN:.4f} GEN"

    report = {"ran_at": int(time.time()), "contract": contract, "court_id": court_id, "appeal_id": appeal_id,
              "reserved": reserved, "ruling": {k: row[k] for k in ("status", "new_level", "reason", "to_member")},
              "judge_votes": judged.get("votes"), "steps": steps,
              "passed": sum(1 for s in steps if s["pass"]), "total": len(steps)}
    (ROOT / "eval" / "e2e.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = [f"# End-to-end run on Studio Next: {report['passed']} of {report['total']} steps passed", "",
             f"Contract [{contract}]({address_url(contract)}), court {court_id}, appeal {appeal_id}.", "",
             "| step | result | transaction | note |", "|---|---|---|---|"]
    for s in steps:
        link = f"[{s['tx'][:10]}…]({s['url']})" if s.get("tx") else ""
        lines.append(f"| {s['step']} | {'pass' if s['pass'] else 'FAIL'} {s.get('status', '')} {s.get('refusal', '')} | {link} | {s.get('note', '')} |")
    (ROOT / "eval" / "e2e.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{report['passed']}/{report['total']} passed; wrote eval/e2e.md")


if __name__ == "__main__":
    main()
