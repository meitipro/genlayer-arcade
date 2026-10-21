#!/usr/bin/env python3
"""
Break one defence of contracts/unban.py at a time and require the direct tests
to fail. A mutant that survives is a missing test, and is reported as a finding.

    python scripts/mutate.py
"""

from __future__ import annotations

import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACT = ROOT / "contracts" / "unban.py"

MUTANTS = [
    ("respond: any sender may answer", 'if sender.as_hex.lower() not in json.loads(court.mods):', "if False:"),
    ("respond: member may answer own appeal", "if sender == appeal.member:", "if False:"),
    ("respond: window never closes", "if now > self._respond_by(court, appeal):\n            raise gl.vm.UserError(E + \"the response window has closed\")", "pass"),
    ("appeal: any fee accepted", "if int(gl.message.value) != int(court.appeal_fee):", "if False:"),
    ("appeal: no cooldown", "if last > 0 and now < last + COOLDOWN_SECONDS:", "if False:"),
    ("appeal: no open-case check", "if int(self.open_cases.get(case_key, u32(0))) != 0:", "if False:"),
    ("appeal: no reserve", "reserve = min(int(court.compensation), int(court.pool))", "reserve = 0"),
    ("update: allowed while open", "if int(court.open_appeals) > 0:\n            raise gl.vm.UserError(E + \"rules are frozen while appeals are open\")", "pass"),
    ("update: applies the same day", "self._now() // 86400 + 1)", "self._now() // 86400)"),
    ("judge: before reply window", 'if appeal.status != "ANSWERED" or not self._reply_closed(appeal):', 'if appeal.status != "ANSWERED":'),
    ("judge: validator ignores level", '(mine["verdict"], mine["level"]) == (theirs["verdict"], theirs.get("level", ""))', 'mine["verdict"] == theirs["verdict"]'),
    ("judge: reduced may be heavier", "if index >= applied:", "if False:"),
    ("judge: overturned pays no compensation", "self._credit(appeal.member, fee + reserved)\n            court.overturned", "self._credit(appeal.member, fee)\n            court.overturned"),
    ("judge: upheld keeps the reserve reserved", "court.pool = u256(int(court.pool) + fee + reserved)", "court.pool = u256(int(court.pool) + fee)"),
    ("judge: no fence", 'return str(text).replace("<", "(").replace(">", ")")', "return str(text)"),
    ("default: before the window", "if now <= self._respond_by(court, appeal):", "if False:"),
    ("withdraw: owner may reclaim with open appeals", "if int(court.open_appeals) > 0:\n                raise gl.vm.UserError(E + \"the pool is locked while appeals are open\")", "pass"),
    ("withdraw: anyone reclaims the pool", "if sender != court.owner:\n                raise gl.vm.UserError(E + \"only the owner may reclaim the pool\")", "pass"),
    ("withdraw: balance not zeroed", "self.balances[sender] = u256(0)", "pass"),
    ("reply: twice", 'if appeal.reply != "":\n            raise gl.vm.UserError(E + "the member has already replied")', "pass"),
    ("rules: repeat lighter allowed", "if repeat < first:", "if False:"),
    ("open_court: hours unbounded", "if hours < MIN_RESPONSE_HOURS or hours > MAX_RESPONSE_HOURS:", "if False:"),
]


def main() -> int:
    original = CONTRACT.read_text(encoding="utf-8")
    survived = []
    try:
        for name, old, new in MUTANTS:
            if original.count(old) != 1:
                print(f"NOT APPLIED  {name}")
                survived.append(name + " (not applied)")
                continue
            CONTRACT.write_text(original.replace(old, new), encoding="utf-8")
            run = subprocess.run([sys.executable, "-m", "pytest", "tests/direct", "-q", "-x", "-p", "no:cacheprovider"],
                                 cwd=ROOT, capture_output=True, text=True)
            caught = run.returncode != 0
            print(f"{'caught  ' if caught else 'SURVIVED'}  {name}")
            if not caught:
                survived.append(name)
    finally:
        CONTRACT.write_text(original, encoding="utf-8")
    print(f"\n{len(MUTANTS) - len(survived)}/{len(MUTANTS)} mutants caught")
    return 1 if survived else 0


if __name__ == "__main__":
    sys.exit(main())
