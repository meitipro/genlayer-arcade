#!/usr/bin/env python3
"""
Run the golden cases in eval/golden.json through real consensus on Studio Next.

    python eval/run_golden.py            # every case once
    python eval/run_golden.py --only 3   # one case

One court is opened for the run from the file's court block. Each case uses
its own member account (one appeal per address per court every 7 days), and
goes appeal -> respond -> reply -> judge, so every ruling has the full record
and four transaction hashes. Results append to eval/results.json and are
rendered to eval/results.md exactly as they came out. H1-H3 carry no expected
answer and are reported as they land. Nothing here retries a judgment.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, (HERE.parent / "scripts").as_posix())

from chain import GEN, Chain, address_url, load_accounts, load_deployment, tx_url  # noqa: E402

RESULTS = HERE / "results.json"
REPORT = HERE / "results.md"


def step(chain: Chain, contract: str, method: str, args: list, value: int = 0) -> dict:
    outcome = chain.send(contract, method, args, value)
    mark = "ok" if outcome["ok"] else "REFUSED " + outcome["refusal"]
    print(f"    {method:12} {outcome['status']:9} {mark}  {outcome['url']}")
    if not outcome["ok"]:
        raise RuntimeError(f"{method} failed: {outcome['detail']}")
    return outcome


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only")
    opts = parser.parse_args()
    golden = json.loads((HERE / "golden.json").read_text(encoding="utf-8"))
    cases = [c for c in golden["cases"] if not opts.only or c["id"] == opts.only]
    deployment = load_deployment()
    contract = deployment["contract"]

    names = ["owner", "mod"] + ["member" + c["id"] for c in cases]
    accounts = load_accounts(names)
    owner = Chain(accounts["owner"])
    for name in names:
        if owner.balance(accounts[name].address) < 10 * GEN:
            owner.fund(accounts[name].address, (150 if name == "owner" else 20) * GEN)

    court_cfg = golden["court"]
    print("opening the eval court")
    opened = step(owner, contract, "open_court", [
        court_cfg["name"], json.dumps(court_cfg["rules"]), json.dumps(court_cfg["ladder"]),
        json.dumps([accounts["mod"].address]), court_cfg["appeal_fee_gen"] * GEN,
        court_cfg["compensation_gen"] * GEN, court_cfg["response_hours"],
    ], court_cfg["pool_gen"] * GEN)
    court_id = owner.read_json(contract, "get_court", [0])["court_count"]
    print(f"  court {court_id}")

    run = {"started": int(time.time()), "contract": contract, "court_id": court_id,
           "open_court_tx": opened["hash"], "cases": []}
    mod = Chain(accounts["mod"])
    today = time.strftime("%Y-%m-%d", time.gmtime())
    for case in cases:
        print(f"case {case['id']}: expected {case['expected']} {case.get('expected_level', '')}")
        member = Chain(accounts["member" + case["id"]])
        row = {"id": case["id"], "expected": case["expected"], "expected_level": case.get("expected_level", "")}
        try:
            row["appeal_tx"] = step(member, contract, "appeal",
                                    [court_id, case["case_ref"], today, case["statement"]],
                                    court_cfg["appeal_fee_gen"] * GEN)["hash"]
            appeal_id = member.read_json(contract, "list_appeals", [court_id, "", 0, 1])[0]["id"]
            row["appeal_id"] = appeal_id
            row["respond_tx"] = step(mod, contract, "respond",
                                     [appeal_id, case["rule"], case["level"], case["evidence"]])["hash"]
            row["reply_tx"] = step(member, contract, "reply", [appeal_id, case["reply"]])["hash"]
            judged = step(member, contract, "judge", [appeal_id])
            row["judge_tx"] = judged["hash"]
            row["votes"] = judged.get("votes")
            got = member.read_json(contract, "get_appeal", [appeal_id])
            row.update({"verdict": got["status"], "level": got["new_level"], "reason": got["reason"]})
            if case["expected"] is None:
                row["match"] = None
            else:
                row["match"] = got["status"] == case["expected"] and got["new_level"] == case.get("expected_level", "")
            print(f"  -> {got['status']} {got['new_level']} ({'held out' if row['match'] is None else 'match' if row['match'] else 'MISS'})")
        except Exception as error:  # noqa: BLE001  a failed case is a result, recorded as one
            row["error"] = str(error)[:300]
            row["match"] = False if case["expected"] else None
            print(f"  -> error {row['error']}")
        run["cases"].append(row)

    history = json.loads(RESULTS.read_text(encoding="utf-8")) if RESULTS.exists() else []
    history.append(run)
    RESULTS.write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")
    render(history, contract)


def render(history: list, contract: str) -> None:
    lines = ["# Golden cases, through real consensus on Studio Next", "",
             f"Contract [{contract}]({address_url(contract)}). Generated by `eval/run_golden.py` from "
             "`eval/results.json`; every row links its transactions. Cases 1-9 have an expected ruling "
             "written before the first run; H1-H3 are held out and shown exactly as they came out.", ""]
    for run in history:
        scored = [c for c in run["cases"] if c["match"] is not None]
        hits = sum(1 for c in scored if c["match"])
        lines += [f"## Run of {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime(run['started']))}, court {run['court_id']}",
                  "", f"{hits} of {len(scored)} expected rulings matched. "
                  f"[open_court]({tx_url(run['open_court_tx'])})", "",
                  "| # | expected | ruled | reason | judge tx | appeal, respond, reply |",
                  "|---|---|---|---|---|---|"]
        for c in run["cases"]:
            expected = (c["expected"] or "held out") + (" " + c["expected_level"] if c.get("expected_level") else "")
            ruled = c.get("verdict", "error") + (" " + c["level"] if c.get("level") else "")
            reason = (c.get("reason") or c.get("error", "")).replace("|", "/")
            judge = f"[judge]({tx_url(c['judge_tx'])})" if c.get("judge_tx") else ""
            others = ", ".join(f"[{k[:-3]}]({tx_url(c[k])})" for k in ("appeal_tx", "respond_tx", "reply_tx") if c.get(k))
            lines.append(f"| {c['id']} | {expected} | {ruled} | {reason} | {judge} | {others} |")
        lines.append("")
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {REPORT.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
