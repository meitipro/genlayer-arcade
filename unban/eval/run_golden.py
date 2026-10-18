"""
The golden cases in eval/golden.json, through real consensus on Studio Next.

Each case is one real appeal on a fresh golden court: a fresh member files it
with the fee, a listed moderator answers with the rule, the level and the
quotes, the member replies once, and judge() is called. The verdict, level and
reason are read back from get_appeal, never from the script's own memory.

Rules from the build notes:
  - golden.json is hashed in eval/golden.sha256 before the first run. The run
    refuses to start if the file no longer matches: no tuning after the fact.
  - Held-out cases H1 to H3 run once, with no expected answer.
  - Every attempt is written to eval/results.json BEFORE anything is printed.
  - A judge is sent again only when its round produced no verdict at all, and
    every attempt is listed.

Run: python eval/run_golden.py            (all cases)
     python eval/run_golden.py 3 H1       (named cases only, appended)
"""

from __future__ import annotations

import datetime
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from chain import GEN, Chain, accounts, explorer_tx, load_deployment  # noqa: E402

GOLDEN = ROOT / "eval" / "golden.json"
SEAL = ROOT / "eval" / "golden.sha256"
RESULTS = ROOT / "eval" / "results.json"
MAX_JUDGE_ATTEMPTS = 3


def sealed() -> dict:
    digest = hashlib.sha256(GOLDEN.read_bytes()).hexdigest()
    recorded = SEAL.read_text(encoding="utf-8").split()[0]
    if digest != recorded:
        raise SystemExit(f"eval/golden.json changed after it was sealed ({recorded[:12]} -> {digest[:12]}). Not running.")
    return json.loads(GOLDEN.read_text(encoding="utf-8"))


def returned_id(outcome: dict) -> int:
    """The id a write returned, read from its receipt; 0 when the receipt does not carry it."""
    try:
        return int(str(outcome.get("result")).strip().strip('"'))
    except (TypeError, ValueError):
        return 0


def persist(record: dict) -> None:
    RESULTS.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")


def main(selected: list[str]) -> None:
    golden = sealed()
    deployment = load_deployment()
    contract = deployment["address"]
    record = json.loads(RESULTS.read_text(encoding="utf-8")) if RESULTS.exists() else {
        "contract": contract, "network": "studio-next", "chain_id": 61997, "cases": []}
    cases = golden["cases"] + golden["held_out"]
    if selected:
        cases = [c for c in cases if c["id"] in selected]

    names = ["owner", "mod"] + [f"member_{c['id']}" for c in cases]
    keys = accounts(names)
    owner = Chain(keys["owner"])
    mod = Chain(keys["mod"])
    for name in names:
        need = 30 * GEN if name == "owner" else 5 * GEN
        if owner.balance(keys[name].address) < need:
            owner.fund(keys[name].address, need * 2)

    court_spec = golden["court"]
    court_id = record.get("court_id")
    if not court_id:
        opened = owner.send(contract, "open_court", [
            court_spec["name"] + " (golden)",
            json.dumps(court_spec["rules"]),
            json.dumps(court_spec["ladder"]),
            json.dumps([keys["mod"].address]),
            court_spec["appeal_fee_gen"] * GEN,
            court_spec["compensation_gen"] * GEN,
            court_spec["response_hours"],
        ], value=20 * GEN)
        court_id = returned_id(opened) or int(json.loads(owner.read(contract, "list_appeals", [0, "", 0, 1]))["courts"])
        record["court_id"] = court_id
        record["open_court_tx"] = opened["hash"]
        persist(record)
    fee = court_spec["appeal_fee_gen"] * GEN
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    for case in cases:
        member = Chain(keys[f"member_{case['id']}"])
        row = {"id": case["id"], "expected": case["expected"], "expected_level": case.get("expected_level", ""),
               "started": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "txs": {}, "judge_attempts": []}
        record["cases"].append(row)
        filed = member.send(contract, "appeal", [court_id, case["case_ref"].format(date=today), case["statement"]], value=fee)
        row["txs"]["appeal"] = filed["hash"]
        appeal_id = returned_id(filed) or int(json.loads(member.read(contract, "list_appeals", [court_id, "", 0, 1]))["items"][0]["id"])
        row["appeal_id"] = appeal_id
        persist(record)
        row["txs"]["respond"] = mod.send(contract, "respond", [appeal_id, case["rule"], case["level"], case["evidence"]])["hash"]
        row["txs"]["reply"] = member.send(contract, "reply", [appeal_id, case["reply"]])["hash"]
        persist(record)
        for _ in range(MAX_JUDGE_ATTEMPTS):
            outcome = owner.send(contract, "judge", [appeal_id], expect_refusal=True)
            row["judge_attempts"].append({"hash": outcome["hash"], "status": outcome["status"], "ok": outcome["ok"], "detail": outcome["detail"]})
            persist(record)
            if outcome["ok"]:
                break
        view = owner.read_json(contract, "get_appeal", [appeal_id])
        row["verdict"] = view["status"]
        row["level"] = view["new_level"]
        row["reason"] = view["reason"]
        if case["expected"] == "EITHER":
            row["pass"] = None
        else:
            row["pass"] = view["status"] == case["expected"] and view["new_level"] == case.get("expected_level", "")
        persist(record)
        print(f"case {case['id']}: {row['verdict']} {row['level']} expected {case['expected']} {case.get('expected_level', '')}"
              f" -> {explorer_tx(row['judge_attempts'][-1]['hash'])}", flush=True)

    write_markdown(record)


def write_markdown(record: dict) -> None:
    scored = [c for c in record["cases"] if c.get("pass") is not None]
    held = [c for c in record["cases"] if c.get("pass") is None and "verdict" in c]
    lines = [
        "# Golden cases, run through consensus on Studio Next",
        "",
        f"Contract `{record['contract']}` on chain 61997. golden.json sha256 `{SEAL.read_text().split()[0]}`, sealed before the first run.",
        "",
        f"Scored: **{sum(1 for c in scored if c['pass'])} of {len(scored)}**. Held-out cases are listed exactly as they came out.",
        "",
        "| Case | Expected | Ruling | Pass | Reason | Judge tx |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for c in scored + held:
        expected = (c["expected"] + " " + c.get("expected_level", "")).strip()
        ruling = (c.get("verdict", "") + " " + c.get("level", "")).strip()
        mark = "-" if c.get("pass") is None else ("yes" if c["pass"] else "**no**")
        last = c["judge_attempts"][-1]["hash"] if c["judge_attempts"] else ""
        lines.append(f"| {c['id']} | {expected} | {ruling} | {mark} | {c.get('reason', '')} | [{last[:10]}]({explorer_tx(last)}) |")
    retried = [c for c in record["cases"] if len(c["judge_attempts"]) > 1]
    if retried:
        lines += ["", "Judge calls sent again because a round produced no verdict:", ""]
        for c in retried:
            lines.append(f"- case {c['id']}: " + ", ".join(f"{a['status']} {a['hash'][:10]}" for a in c["judge_attempts"]))
    (ROOT / "eval" / "results.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1:])
