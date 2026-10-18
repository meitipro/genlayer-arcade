"""
The reviewer's path, from accounts that have never touched the contract, to
finality, with the money checked to the wei and two refusals put on chain.

  faucet -> open_court -> appeal -> (refused: member answers own appeal)
  -> respond -> (refused: judge before the reply window) -> reply -> judge
  -> withdraw (finalized) -> (refused: withdraw again)

The contract's own GEN balance must drop by exactly fee + compensation at the
withdraw. Members pay consensus fees on every write, so their balances are
reported, and the contract's balance is the one compared to the wei.

Writes evidence/walk.json before printing a summary.
Run: python scripts/walk.py
"""

from __future__ import annotations

import datetime
import json
import pathlib

from chain import GEN, ROOT, Chain, accounts, explorer_address, explorer_tx, load_deployment

OUT = ROOT / "evidence" / "walk.json"
GOLDEN = json.loads((ROOT / "eval" / "golden.json").read_text(encoding="utf-8"))


def main() -> None:
    contract = load_deployment()["address"]
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S")
    names = [f"walk_owner_{stamp}", f"walk_mod_{stamp}", f"walk_member_{stamp}"]
    keys = accounts(names)
    owner, mod, member = (Chain(keys[n]) for n in names)
    o, m, b = (keys[n].address for n in names)
    log: dict = {"contract": contract, "started": stamp, "accounts": {"owner": o, "moderator": m, "member": b}, "steps": []}

    def save() -> None:
        OUT.write_text(json.dumps(log, indent=2) + "\n", encoding="utf-8")

    def step(name: str, outcome: dict, **extra) -> None:
        log["steps"].append({"step": name, "hash": outcome["hash"], "ok": outcome["ok"], "status": outcome["status"],
                             "refusal": outcome.get("refusal", ""), "explorer": explorer_tx(outcome["hash"]), **extra})
        save()

    for who in (o, m, b):
        before, after = owner.fund(who, 50 * GEN)
        log.setdefault("faucet", {})[who] = {"before": str(before), "after": str(after)}
    save()

    court = GOLDEN["court"]
    opened = owner.send(contract, "open_court", [
        "Kiln Discord (walk " + stamp[-6:] + ")", json.dumps(court["rules"]), json.dumps(court["ladder"]),
        json.dumps([m]), 2 * GEN, 5 * GEN, 48], value=10 * GEN)
    court_id = int(str(opened["result"]).strip('"'))
    step("open_court", opened, court_id=court_id)

    case = GOLDEN["cases"][0]
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    filed = member.send(contract, "appeal", [court_id, case["case_ref"].format(date=today), case["statement"]], value=2 * GEN)
    appeal_id = int(str(filed["result"]).strip('"'))
    step("appeal", filed, appeal_id=appeal_id)

    step("refused: member answers own appeal", member.send(contract, "respond", [appeal_id, 1, 4, "x"], expect_refusal=True))
    step("respond", mod.send(contract, "respond", [appeal_id, case["rule"], case["level"], case["evidence"]]))
    step("refused: judge before the reply window", owner.send(contract, "judge", [appeal_id], expect_refusal=True))
    step("reply", member.send(contract, "reply", [appeal_id, case["reply"]]))
    judged = owner.send(contract, "judge", [appeal_id], expect_refusal=True)
    view = owner.read_json(contract, "get_appeal", [appeal_id])
    step("judge", judged, verdict=view["status"], level=view["new_level"], reason=view["reason"], member_balance=view["member_balance"])

    owed = int(view["member_balance"])
    held_before = owner.balance(contract)
    member_before = owner.balance(b)
    withdrawn = member.send(contract, "withdraw", [], finalized=True)
    held_after = owner.balance(contract)
    member_after = owner.balance(b)
    step("withdraw", withdrawn, owed=str(owed), contract_before=str(held_before), contract_after=str(held_after),
         contract_drop=str(held_before - held_after), member_before=str(member_before), member_after=str(member_after),
         exact=(held_before - held_after) == owed)
    step("refused: withdraw again", member.send(contract, "withdraw", [], expect_refusal=True))

    log["finished"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S")
    save()
    print(f"contract {explorer_address(contract)}")
    for s in log["steps"]:
        print(f"  {s['step']}: {'ok' if s['ok'] else 'refused ' + s['refusal']} {s['explorer']}")
    last = log["steps"][-2]
    print(f"  contract balance dropped {int(last['contract_drop']) / GEN} GEN, owed {owed / GEN} GEN, exact={last['exact']}")


if __name__ == "__main__":
    main()
