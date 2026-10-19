"""
What the GitHub runner executes: the tasks named in chain/REQUEST.json, in
order, each with its output saved under chain/out/. The workflow commits
chain/out, eval results and deployments.json back to the branch.

The development container cannot reach the GenLayer RPC; a GitHub runner can.
Nothing secret is involved: every account is made fresh inside the run.
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "chain" / "out"

TASKS = {
    "probe": [sys.executable, "scripts/probe.py"],
    "deploy": [sys.executable, "scripts/deploy.py"],
    "verify": [sys.executable, "scripts/verify.py"],
    "golden": [sys.executable, "eval/run_golden.py"],
    "golden-report": [sys.executable, "eval/run_golden.py", "--report"],
    "seed": [sys.executable, "scripts/seed.py"],
    "site-e2e": ["bash", "-c", "cd web && node scripts/generate.mjs && npx tsx e2e/site.mts"],
    "browser-e2e": ["bash", "-c", "cd web && npm i --no-save --no-audit --no-fund playwright@1.64.1 && npx playwright install --with-deps chromium && rm -rf .next out && npm run build && node e2e/browser.mjs"],
    "no-show-settle": [sys.executable, "scripts/no_show.py", "settle"],
}


def main() -> int:
    request = json.loads((ROOT / "chain" / "REQUEST.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    failed = []
    for task in request["tasks"]:
        command = TASKS[task] + request.get("args", {}).get(task, [])
        print(f"\n=== {task}: {' '.join(command[1:])}", flush=True)
        started = time.time()
        log = OUT / f"{task}.log"
        with log.open("w", encoding="utf-8") as handle:
            process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in process.stdout:
                sys.stdout.write(line)
                sys.stdout.flush()
                handle.write(line)
                handle.flush()
            code = process.wait()
        print(f"=== {task}: exit {code} in {time.time() - started:.0f}s", flush=True)
        if code != 0:
            failed.append(task)
            if task in request.get("stop_on_failure", ["deploy"]):
                break
    (OUT / "last-run.json").write_text(json.dumps({"request": request, "failed": failed}, indent=2) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
