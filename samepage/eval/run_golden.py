"""
The golden cases of section 9, through real consensus on Studio Next.

    python eval/run_golden.py            # every case not yet in results.json
    python eval/run_golden.py 4 H2       # just these

Each case is one page between two fresh accounts, zero deposit: open, join,
both seal, both open, check. The statuses are read back from get_page, not
from the receipt that arrived first. A case is scored on all six statuses.

Rules this follows:
  - golden.json is hashed in GOLDEN.lock and was committed before the first
    run; the script refuses to run if the file no longer matches (rule 34).
  - H1 to H3 have no expected answer and are run once.
  - A check is sent again only when its round produced no verdict at all, and
    every attempt is listed (rule 34).
  - Each attempt is written to results.json before anything is printed about
    it (rule 33).
"""

from __future__ import annotations

import datetime
import hashlib
import json
import pathlib
import sys
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

from chain import GEN, TERMS_ORDER, current_address, fresh, save_json, tx_url  # noqa: E402
from flow import Side, check, join, open_page, write_round  # noqa: E402

GOLDEN = HERE / "golden.json"
LOCK = HERE / "GOLDEN.lock"
RESULTS = HERE / "results.json"
_lock = threading.Lock()


def locked_hash() -> str:
    return LOCK.read_text(encoding="utf-8").split()[1]


def load_results() -> dict:
    if RESULTS.exists():
        return json.loads(RESULTS.read_text(encoding="utf-8"))
    return {"cases": {}}


def record(case_id: str, entry: dict) -> None:
    with _lock:
        data = load_results()
        data["cases"][case_id] = entry
        data["golden_sha256"] = locked_hash()
        save_json(RESULTS, data)


def run_case(address: str, case: dict) -> dict:
    cid = case["id"]
    started = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    entry = {"id": cid, "started": started, "contract": address, "steps": {}, "attempts": []}
    try:
        a = Side("opener", fresh(f"{cid} opener"))
        b = Side("counterparty", fresh(f"{cid} other"))
        for side in (a, b):
            side.chain.fund(side.address, 20 * GEN)
        page, opened = open_page(a, address, case["title"], b.address, 0, 6)
        entry["page"] = page
        entry["steps"]["open_page"] = opened["hash"]
        entry["steps"]["join"] = join(b, address, page, 0)["hash"]
        steps = write_round(a, b, address, page, 1, case["a"], case["b"])
        for name, outcome in steps.items():
            entry["steps"][name] = outcome["hash"]
        record(cid, entry)
        for attempt in range(3):
            try:
                outcome = check(a, address, page)
                entry["attempts"].append({"tx": outcome["hash"], "ok": True})
                break
            except Exception as error:  # noqa: BLE001
                entry["attempts"].append({"ok": False, "error": str(error)[:300]})
                record(cid, entry)
                row = a.chain.read_json(address, "get_page", [page])
                if row["rounds"][0]["verdict"]:
                    break
        row = a.chain.read_json(address, "get_page", [page])
        r = row["rounds"][0]
        entry["statuses"] = dict(zip(TERMS_ORDER, r["statuses"])) if r["statuses"] else None
        entry["verdict"] = r["verdict"] or None
        entry["split"] = r.get("split", [])
        entry["notes"] = r.get("notes", {})
        entry["step_after"] = row["step"]
        if case["expected"] is not None and entry["statuses"]:
            entry["terms_right"] = sum(entry["statuses"][t] == case["expected"][t] for t in TERMS_ORDER)
            entry["pass"] = entry["statuses"] == case["expected"]
        entry["verdict_expected"] = case["verdict"]
    except Exception as error:  # noqa: BLE001
        entry["error"] = f"{type(error).__name__}: {str(error)[:400]}"
        entry["trace"] = traceback.format_exc()[-1200:]
    entry["finished"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    record(cid, entry)
    verdict = entry.get("verdict")
    print(f"case {cid}: {verdict} {entry.get('statuses')} pass={entry.get('pass')} error={entry.get('error', '')[:120]}", flush=True)
    return entry


def report() -> str:
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    data = load_results()
    lines = [
        "# Golden cases, through real consensus",
        "",
        f"Contract `{data['cases'][next(iter(data['cases']))]['contract'] if data['cases'] else '?'}` on Studio Next (chain 61997).",
        f"`eval/golden.json` sha256 `{locked_hash()}`, committed before the first run (see `eval/GOLDEN.lock` and its commit).",
        "Scored on all six statuses. H1 to H3 are held out, have no expected answer, ran once, and are published as they came out.",
        "",
        "| case | expected | came out | six statuses (amount, deliverable, deadline, payment, rights, cancellation) | terms right | result | check transaction |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    scored = passed = 0
    for case in golden["cases"]:
        e = data["cases"].get(case["id"])
        if not e:
            lines.append(f"| {case['id']} | {case['verdict']} | not run | | | | |")
            continue
        statuses = e.get("statuses")
        cells = " · ".join(statuses[t] for t in TERMS_ORDER) if statuses else "no verdict"
        ok_tx = [x["tx"] for x in e.get("attempts", []) if x.get("ok")]
        link = f"[{ok_tx[-1][:10]}…]({tx_url(ok_tx[-1])})" if ok_tx else "none"
        verdict = e.get("verdict") or "none"
        n_differ = sum(1 for s in (statuses or {}).values() if s == "DIFFER")
        shown = verdict.replace("_", " ") + (f" · {n_differ}" if verdict == "DIFFERENT" else "")
        if verdict == "GAPS" and statuses:
            shown = f"GAPS · {sum(1 for t in TERMS_ORDER[:3] if statuses[t] == 'ABSENT')}"
        if case["expected"] is None:
            result = "held out"
            right = ""
        else:
            scored += 1
            passed += 1 if e.get("pass") else 0
            result = "pass" if e.get("pass") else "**miss**"
            right = f"{e.get('terms_right', 0)} / 6"
        attempts = len(e.get("attempts", []))
        if attempts > 1:
            result += f" ({attempts} attempts)"
        lines.append(f"| {case['id']} | {case['verdict'].replace('_', ' ')} | {shown} | {cells} | {right} | {result} | {link} |")
    lines += ["", f"**{passed} of {scored}** scored cases matched on all six statuses.", ""]
    splits = [(cid, e.get("split")) for cid, e in data["cases"].items() if e.get("split")]
    if splits:
        lines.append("Terms the two presentation orders read differently, stored as DIFFER: " + "; ".join(f"case {c}: {', '.join(s)}" for c, s in splits) + ".")
        lines.append("")
    lines.append("Every step of every case (open, join, two seals, two opens, check) is in `eval/results.json` with its transaction hash.")
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    text = GOLDEN.read_text(encoding="utf-8")
    if hashlib.sha256(text.encode()).hexdigest() != locked_hash():
        print("eval/golden.json no longer matches GOLDEN.lock; refusing to run")
        return 1
    if argv == ["--report"]:
        (HERE / "results.md").write_text(report(), encoding="utf-8")
        print(report())
        return 0
    golden = json.loads(text)
    done = load_results()["cases"]
    if argv:
        wanted = [c for c in golden["cases"] if c["id"] in argv]
    else:
        # A case already on record is never sent again; one that never reached
        # a check (it failed before) is.
        wanted = [c for c in golden["cases"] if c["id"] not in done or not done[c["id"]].get("attempts")]
    address = current_address()
    print(f"running {[c['id'] for c in wanted]} against {address}", flush=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(lambda c: run_case(address, c), wanted))
    (HERE / "results.md").write_text(report(), encoding="utf-8")
    print(report(), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
