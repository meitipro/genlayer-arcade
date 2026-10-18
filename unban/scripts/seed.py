"""
Seed the live site with a realistic mix beside the golden court: a Kiln
Discord court with appeals waiting at the moderator desk, and a Quill Telegram
court with a 12 hour window whose unanswered appeal defaults.

  python scripts/seed.py            open the courts and file the appeals
  python scripts/seed.py --finish   call default() on every appeal whose window has passed

Writes evidence/seed.json. Nothing here invents a verdict: rulings come only
from judge() through consensus (eval/run_golden.py) or default() on chain time.
"""

from __future__ import annotations

import datetime
import json
import sys

from chain import GEN, ROOT, Chain, accounts, explorer_tx, load_deployment

OUT = ROOT / "evidence" / "seed.json"
GOLDEN = json.loads((ROOT / "eval" / "golden.json").read_text(encoding="utf-8"))

QUILL_RULES = [
    {"text": "Be civil: no insults, slurs or harassment.", "first": 2, "repeat": 3},
    {"text": "No links to token sales, presales or airdrops.", "first": 3, "repeat": 3},
    {"text": "English in the main group.", "first": 1, "repeat": 2},
]
QUILL_LADDER = ["warning", "24h mute", "ban"]

WAITING = [
    ("Kiln", "mirrr2 on Discord, banned {date}",
     "One gm too many and I am banned? I spammed gm at launch, I know, but a first spam is a mute in the rules.", None),
    ("Kiln", "0xbeck on Discord, banned {date}",
     "Caught in the raid purge. I have been a member since the testnet and posted nothing during the raid.",
     (1, 4, "[22:10 #general] 0xbeck: lol the raid bots are back\n[22:11 #general] 0xbeck: mods pls")),
    ("Quill", "hollis on Telegram, banned {date}",
     "Banned for posting in Spanish once. The rules say a warning for that.", None),
]


def main(finish: bool) -> None:
    contract = load_deployment()["address"]
    keys = accounts(["seed_owner", "seed_mod", "seed_m0", "seed_m1", "seed_m2"])
    owner = Chain(keys["seed_owner"])
    log = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"contract": contract, "txs": []}

    def save() -> None:
        OUT.write_text(json.dumps(log, indent=2) + "\n", encoding="utf-8")

    if finish:
        for appeal_id in log.get("appeals", []):
            view = owner.read_json(contract, "get_appeal", [appeal_id])
            now = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
            if view["status"] == "FILED" and now > view["respond_by"]:
                done = owner.send(contract, "default", [appeal_id])
                log["txs"].append({"step": f"default {appeal_id}", "hash": done["hash"]})
                save()
                print(f"default {appeal_id} {explorer_tx(done['hash'])}")
        return

    for name in keys:
        if owner.balance(keys[name].address) < 20 * GEN:
            owner.fund(keys[name].address, 60 * GEN)
    mod = keys["seed_mod"].address
    court = GOLDEN["court"]
    kiln = owner.send(contract, "open_court", ["Kiln Discord", json.dumps(court["rules"]), json.dumps(court["ladder"]),
                                               json.dumps([mod]), 2 * GEN, 5 * GEN, 48], value=40 * GEN)
    quill = owner.send(contract, "open_court", ["Quill Telegram", json.dumps(QUILL_RULES), json.dumps(QUILL_LADDER),
                                                json.dumps([mod]), 1 * GEN, 2 * GEN, 12], value=10 * GEN)
    ids = {"Kiln": int(str(kiln["result"]).strip('"')), "Quill": int(str(quill["result"]).strip('"'))}
    fees = {"Kiln": 2 * GEN, "Quill": 1 * GEN}
    log["courts"] = ids
    log["txs"] += [{"step": "open Kiln", "hash": kiln["hash"]}, {"step": "open Quill", "hash": quill["hash"]}]
    save()
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    log["appeals"] = []
    for index, (court_name, case, statement, answer) in enumerate(WAITING):
        member = Chain(keys[f"seed_m{index}"])
        filed = member.send(contract, "appeal", [ids[court_name], case.format(date=today), statement], value=fees[court_name])
        appeal_id = int(str(filed["result"]).strip('"'))
        log["appeals"].append(appeal_id)
        log["txs"].append({"step": f"appeal {appeal_id}", "hash": filed["hash"]})
        save()
        if answer:
            rule, level, quotes = answer
            done = Chain(keys["seed_mod"]).send(contract, "respond", [appeal_id, rule, level, quotes])
            log["txs"].append({"step": f"respond {appeal_id}", "hash": done["hash"]})
            save()
    for row in log["txs"]:
        print(f"{row['step']}: {explorer_tx(row['hash'])}")


if __name__ == "__main__":
    main("--finish" in sys.argv)
