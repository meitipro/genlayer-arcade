"""
Rule 17: break every defence on purpose and check that a test fails.

Each mutation is one textual change to contracts/unban.py. The suite runs
against the mutated copy; a mutation that leaves the suite green is an escape,
and the script exits non-zero and refuses to call the table complete.

Run: python scripts/mutate.py   (writes tests/MUTATIONS.md)
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "contracts" / "unban.py").read_text(encoding="utf-8")

MUTATIONS = [
    ("owner check on update_court", "if gl.message.sender_address != court.owner:", "if False:"),
    ("rules frozen while appeals open", "if court.open_appeals > 0:", "if False:"),
    ("exact appeal fee", "if gl.message.value != court.appeal_fee:", "if False:"),
    ("one open appeal per case", "if key in self.open_cases:\n            raise", "if False:\n            raise"),
    ("seven day cooldown", "if int(last) > 0 and now < int(last) + COOLDOWN_SECONDS:", "if False:"),
    ("future ban date", "if ban > _date_of(now):", "if False:"),
    ("moderator list on respond", "if gl.message.sender_address.as_hex.lower() not in json.loads(court.mods_json):", "if False:"),
    ("response window on respond", "if now > int(a.filed_at) + int(court.response_hours) * 3600:\n            raise gl.vm.UserError(E + \"the response window has closed\")", "if False:\n            pass"),
    ("rule bound", "if rule < 1 or rule > len(rules):", "if False:"),
    ("level bound", "if level < 1 or level > len(ladder):", "if False:"),
    ("member only reply", "if gl.message.sender_address != a.member:", "if False:"),
    ("one reply", "if a.reply != \"\":", "if False:"),
    ("reply window", "if now > int(a.answered_at) + REPLY_SECONDS:", "if False:"),
    ("judge waits for reply window", "if a.reply == \"\" and now <= int(a.answered_at) + REPLY_SECONDS:", "if False:"),
    ("default waits for window", "if now <= int(a.filed_at) + int(court.response_hours) * 3600:", "if False:"),
    ("reduced level must be lighter", "if number > levels or number >= applied:", "if number > levels:"),
    ("validator compares level", "and mine[\"level\"] == theirs.get(\"level\")", ""),
    ("validator compares verdict", "return mine[\"verdict\"] == theirs.get(\"verdict\") and", "return True and"),
    ("model failure never agreed", "    if mine.startswith(E):\n        return mine == leader_message\n    return False", "    return True"),
    ("fence", 'return str(text).replace("<", "(").replace(">", ")")', "return str(text)"),
    ("overturned pays compensation", "self.balances[appeal.member] = u256(self.balances.get(appeal.member, u256(0)) + fee + reserve)", "self.balances[appeal.member] = u256(self.balances.get(appeal.member, u256(0)) + fee)"),
    ("upheld fee to pool", "court.pool = u256(court.pool + fee + reserve)", "court.pool = u256(court.pool + reserve)"),
    ("reserve on filing", "reserve = court.compensation\n", "reserve = u256(0)\n"),
    ("withdraw zeroes balance", "            self.balances[who] = u256(0)\n", "            pass\n"),
    ("reclaim only idle pools", "and int(court.open_appeals) == 0 and", "and"),
    ("reclaim only own courts", "if court.owner == who and", "if"),
    ("repeat not lighter than first", "if repeat < first:", "if False:"),
    ("ladder size", "if not isinstance(ladder, list) or len(ladder) < 1 or len(ladder) > MAX_LEVELS:", "if not isinstance(ladder, list):"),
    ("rules size", "if total > MAX_RULES_CHARS:", "if False:"),
    ("response window bounds", "if response_hours < MIN_RESPONSE_HOURS or response_hours > MAX_RESPONSE_HOURS:", "if False:"),
    ("rules apply after the change", "if rs.effective_from < ban_date or int(rs.prev) == 0:", "if True:"),
    ("offences counted", "self.offences[key] = u256(self.offences.get(key, u256(0)) + 1)", "pass"),
]


def main() -> int:
    rows = []
    escaped = []
    py = sys.executable
    for name, old, new in MUTATIONS:
        if SOURCE.count(old) != 1:
            print(f"mutation '{name}' does not match the source exactly once; fix the table")
            return 2
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(SOURCE.replace(old, new))
            path = f.name
        run = subprocess.run([py, "-m", "pytest", str(ROOT / "tests"), "-q", "-x", "-p", "no:cacheprovider"],
                             env={**os.environ, "UNBAN_SOURCE": path}, capture_output=True, text=True, cwd=ROOT)
        os.unlink(path)
        caught = run.returncode != 0
        killer = ""
        for line in run.stdout.splitlines():
            if line.startswith("FAILED"):
                killer = line.split("::")[-1].split(" ")[0]
                break
        rows.append(f"| {name} | {'caught' if caught else '**ESCAPED**'} | `{killer}` |")
        if not caught:
            escaped.append(name)
        print(f"{'caught ' if caught else 'ESCAPED'} {name} {killer}", flush=True)
    if escaped:
        print(f"{len(escaped)} mutation(s) escaped: {escaped}. Not writing the table.")
        return 1
    (ROOT / "tests" / "MUTATIONS.md").write_text(
        "# Mutations\n\nGenerated by `scripts/mutate.py`. Every defence in `contracts/unban.py` was broken on purpose, one at a time;"
        f" each row names the first test that failed.\n\n**{len(rows)} mutations, none escaped.**\n\n| Defence broken | Result | Caught by |\n| --- | --- | --- |\n"
        + "\n".join(rows) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
