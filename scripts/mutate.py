#!/usr/bin/env python3
"""
Break each defence in the contracts one at a time and confirm the offline suite
catches it. A mutant that survives means a defence no test holds.

    python scripts/mutate.py
"""

from __future__ import annotations

import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

MUTANTS = [
    ("daily_verdict.py", "fence removed", 'return text.replace("<", "\u2039").replace(">", "\u203a")', "return text"),
    ("daily_verdict.py", "owner check removed", '        if gl.message.sender_address != self.owner:\n            raise gl.vm.UserError("[EXPECTED] not owner")', "        pass"),
    ("daily_verdict.py", "tolerance widened to 2", "return abs(ls - vs) <= 1", "return abs(ls - vs) <= 2"),
    ("daily_verdict.py", "zero no longer exact", "                return ls == vs", "                return abs(ls - vs) <= 1"),
    ("daily_verdict.py", "duplicate entries allowed", '        if key in self.entries:\n            raise gl.vm.UserError("[EXPECTED] already submitted")', "        pass"),
    ("daily_verdict.py", "closed rounds accept entries", " or not self.round_open[round_id]:", ":"),
    ("daily_verdict.py", "entry length unchecked", "if len(entry) == 0 or len(entry) > MAX_ENTRY:", "if False:"),
    ("daily_verdict.py", "score not clamped", "score = max(0, min(10, score))", "pass"),
    ("word_bridge.py", "start/end unchecked", 'if words[0] != r["start"] or words[-1] != r["end"]:', "if False:"),
    ("word_bridge.py", "validators ignore validity", "return all(leader_result.calldata) == all(mine)", "return True"),
    ("word_bridge.py", "hop penalty wrong", "(100 - 15 * (hops - 1))", "(100 - 10 * (hops - 1))"),
    ("word_bridge.py", "duplicate words allowed", "len(set(words)) != len(words) or ", ""),
    ("word_bridge.py", "owner check removed on open", '        if gl.message.sender_address != self.owner:\n            raise gl.vm.UserError("[EXPECTED] not owner")\n        start, end', "        start, end"),
    ("oracle_guess.py", "tolerance widened to 2%", "<= 0.01", "<= 0.02"),
    ("oracle_guess.py", "resolve without lock", 'if r["state"] != "locked":', "if False:"),
    ("oracle_guess.py", "guess after lock", '        if r["state"] != "open":\n            raise gl.vm.UserError("[EXPECTED] guessing closed")', "        pass"),
    ("oracle_guess.py", "http allowed", 'if not url.startswith("https://"):', "if False:"),
    ("oracle_guess.py", "ranking not by distance", 'ranked.sort(key=lambda x: x["off"])', "pass"),
    ("oracle_guess.py", "owner check removed", '        if gl.message.sender_address != self.owner:\n            raise gl.vm.UserError("[EXPECTED] not owner")', "        pass"),
    ("season_ledger.py", "owner check removed", '        if gl.message.sender_address != self.owner:\n            raise gl.vm.UserError("[EXPECTED] not owner")', "        pass"),
    ("season_ledger.py", "seasons can be overwritten", '        if key in self.seasons:\n            raise gl.vm.UserError("[EXPECTED] season already recorded")', "        pass"),
    ("season_ledger.py", "payload size unchecked", "if len(payload) > 8000:", "if False:"),
    ('game_review.py', 'owner check removed', '        if gl.message.sender_address != self.owner:\n            raise gl.vm.UserError("[EXPECTED] not owner")', '        pass'),
    ('game_review.py', 'validators ignore the label', 'return str(leader_result.calldata["label"]) == mine["label"]', 'return True'),
    ("game_review.py", "fence removed", 'return text.replace("<", "\u2039").replace(">", "\u203a")', "return text"),
    ('game_review.py', 'http allowed', 'URL_RE = re.compile(r"^https://', 'URL_RE = re.compile(r"^https?://'),
    ('game_review.py', 'duplicate links allowed', '        if url in self.by_url:\n            raise gl.vm.UserError("[EXPECTED] already submitted")', '        pass'),
    ('game_review.py', 'not-a-game listed', '"listed": verdict["label"] == "PLAYABLE", "rechecked": False', '"listed": True, "rechecked": False'),
    ('game_review.py', 'unlimited rechecks', '        if g["rechecked"]:\n            raise gl.vm.UserError("[EXPECTED] already rechecked once")', '        pass'),
    ('game_review.py', 'recheck any label', '        if g["label"] != "UNREACHABLE":\n            raise gl.vm.UserError("[EXPECTED] only an unreachable review can be rechecked")', '        pass'),
    ("game_review.py", "closed label set removed (both checks)", ['if label not in ("PLAYABLE", "NOT_A_GAME"):', "if label not in LABELS:"], ["if False:", "if False:"]),
    ('game_review.py', 'model asked about unreadable pages', 'if len(text) < MIN_PAGE:', 'if False:'),
]


def main() -> int:
    survived = []
    for file, name, old, new in MUTANTS:
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(ROOT / "contracts", tmp, dirs_exist_ok=True)
            p = pathlib.Path(tmp) / file
            src = p.read_text(encoding="utf-8")
            olds, news = (old, new) if isinstance(old, list) else ([old], [new])
            if any(o not in src for o in olds):
                print(f"  ?? {file}: {name}: pattern not found")
                survived.append((file, name, "pattern not found"))
                continue
            for o, n in zip(olds, news):
                src = src.replace(o, n, 1)
            p.write_text(src, encoding="utf-8", newline="\n")
            env = dict(os.environ, ARCADE_CONTRACTS_DIR=tmp)
            r = subprocess.run([sys.executable, "-m", "pytest", "-q", "-x", "tests/contracts/test_contracts.py", "-p", "no:cacheprovider"], cwd=ROOT, env=env, capture_output=True, text=True)
            caught = r.returncode != 0
            failing = next((ln.split(" ")[1] for ln in r.stdout.splitlines() if ln.startswith("FAILED")), "")
            print(f"  {'caught ' if caught else 'ESCAPED'} {file}: {name}  {failing}")
            if not caught:
                survived.append((file, name, ""))
    print(f"\n{len(MUTANTS) - len(survived)}/{len(MUTANTS)} mutants caught")
    return 1 if survived else 0


if __name__ == "__main__":
    raise SystemExit(main())
