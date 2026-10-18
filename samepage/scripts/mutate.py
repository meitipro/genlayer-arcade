"""
Mutate every defence in contracts/samepage.py and require a test to catch each.

A passing count is a claim; this table is the evidence. Each mutation is one
textual edit to a copy of the contract, the direct and static tests run against
the copy, and the mutation must make at least one test fail. The script refuses
to print a table if any mutation escapes, because an escape means a missing
test, or a test that can no longer fail.

    python scripts/mutate.py            # prints the table, exits 1 on an escape
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACT = ROOT / "contracts" / "samepage.py"

#: (name, original text, mutated text). Each original must occur exactly once.
MUTATIONS = [
    ("join: anyone may join", 'if gl.message.sender_address != self.pages[key].counterparty:\n            raise gl.vm.UserError(E + "only the named counterparty can join")', 'if False:\n            raise gl.vm.UserError(E + "only the named counterparty can join")'),
    ("join: any deposit", 'if int(gl.message.value) != int(self.pages[key].deposit):', 'if False:'),
    ("open: any value sent", 'if int(gl.message.value) != int(deposit):', 'if False:'),
    ("open: counterparty may be the opener", 'if other == who:', 'if False:'),
    ("open: title 81", 'MAX_TITLE = 80', 'MAX_TITLE = 81'),
    ("open: window from 5 hours", 'MIN_WINDOW_HOURS = 6', 'MIN_WINDOW_HOURS = 5'),
    ("open: window to 97 hours", 'MAX_WINDOW_HOURS = 96', 'MAX_WINDOW_HOURS = 97'),
    ("windows never close", 'if self._now() > self.pages[key].deadline:', 'if False:'),
    ("any address is a side", 'raise gl.vm.UserError(E + "not a side of this page")', 'return "a"'),
    ("seal: twice per round", 'if mine != "":\n            raise gl.vm.UserError(E + "you have sealed this round already")', 'if False:\n            raise gl.vm.UserError(E + "you have sealed this round already")'),
    ("seal: copy the other side", 'if value == theirs:', 'if False:'),
    ("seal: any string", 'if not _is_hex(value, 64, 64):', 'if False:'),
    ("reveal: before both sealed", 'if self.pages[key].step != OPENING:', 'if self.pages[key].step not in (OPENING, SEALING):'),
    ("reveal: no seal check", 'if seal_of(text, salt, gl.message.sender_address.as_hex) != sealed:', 'if False:'),
    ("reveal: seal without the address", 'return hashlib.sha256((text + "|" + salt + "|" + address_hex.lower()).encode("utf-8")).hexdigest()', 'return hashlib.sha256((text + "|" + salt).encode("utf-8")).hexdigest()'),
    ("reveal: any salt", 'if not _is_hex(salt, 16, 64):', 'if False:'),
    ("reveal: account 1201", 'MAX_ACCOUNT = 1200', 'MAX_ACCOUNT = 1201'),
    ("reveal: open twice", 'if opened != "":', 'if False:'),
    ("verdict: gaps ignored", 'if any(by_term[t] == "ABSENT" for t in REQUIRED):\n        return GAPS', 'if False:\n        return GAPS'),
    ("verdict: differ ignored", 'if any(by_term[t] == "DIFFER" for t in TERMS):\n        return DIFFERENT', 'if False:\n        return DIFFERENT'),
    ("judge: orders not compared", 'if forward[term] == reverse[term]:', 'if True:'),
    ("validator: always agrees", 'return [mine[t] for t in TERMS] == [theirs[t] for t in TERMS]', 'return True'),
    ("parse: unknown status allowed", 'if status not in STATUSES:\n            raise gl.vm.UserError(L + "bad status for " + term)', 'if status not in STATUSES:\n            status = "ABSENT"'),
    ("parse: no retry", 'if not message.startswith(L):\n            raise', 'raise first'),
    ("fence: does nothing", 'return str(raw).replace("<", "(").replace(">", ")")', 'return str(raw)'),
    ("check: before both open", 'if self.pages[key].step != CHECKING:\n            raise gl.vm.UserError(E + "not ready: both accounts must be open")', 'if self.pages[key].step not in (CHECKING, OPENING):\n            raise gl.vm.UserError(E + "not ready: both accounts must be open")'),
    ("check: third round", 'MAX_ROUNDS = 2', 'MAX_ROUNDS = 3'),
    ("check: round two keeps deposits", 'self._return_both(key)\n            self._close(key, NOT_AGREED)\n\n    @gl.public.write\n    def sign', 'self._close(key, NOT_AGREED)\n\n    @gl.public.write\n    def sign'),
    ("sign: any step", 'raise gl.vm.UserError(E + "only a SAME PAGE record can be signed")', 'pass'),
    ("sign: twice", 'if self.rounds[rk].a_signed:\n                raise', 'if False:\n                raise'),
    ("sign: one signature agrees", 'if self.rounds[rk].a_signed and self.rounds[rk].b_signed:', 'if self.rounds[rk].a_signed or self.rounds[rk].b_signed:'),
    ("no_show: before the window", 'if self._now() <= self.pages[key].deadline:\n            raise gl.vm.UserError(E + "the window for this step is still open")', 'if False:\n            raise gl.vm.UserError(E + "the window for this step is still open")'),
    ("no_show: on a closed page", 'if step not in LIVE:', 'if False:'),
    ("no_show: deposit to the absent side", 'self._credit(opener, u256(int(deposit) * 2))\n            self._mark_absent(key, [other])', 'self._credit(other, u256(int(deposit) * 2))\n            self._mark_absent(key, [other])'),
    ("no_show: joining refunds nobody", 'if step == JOINING:\n            self._credit(opener, deposit)', 'if step == JOINING:\n            pass'),
    ("no_show: stuck check keeps deposits", 'if step == CHECKING:\n            self._return_both(key)', 'if step == CHECKING:\n            pass'),
    ("no_show: not recorded", 'self.no_shows[name] = u32(current + 1)', 'pass'),
    ("withdraw: balance not cleared", 'self.balances[who] = u256(0)\n        self.held', 'self.held'),
    ("withdraw: zero allowed", 'if amount == u256(0):\n            raise gl.vm.UserError(E + "nothing to withdraw")', 'if False:\n            raise gl.vm.UserError(E + "nothing to withdraw")'),
    ("list: zero address lists nothing", 'if target == ZERO:\n            total = len(self.order)', 'if False:\n            total = len(self.order)'),
    ("list: no cap", 'if want > MAX_LIST:\n            want = MAX_LIST', 'if False:\n            want = MAX_LIST'),
]


def run(path: pathlib.Path) -> bool:
    """True when the suite passes against the contract at path."""
    env = dict(os.environ, SAMEPAGE_CONTRACT=str(path))
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests", "-q", "-x", "-p", "no:cacheprovider"],
        cwd=ROOT, env=env, capture_output=True, text=True,
    )
    return result.returncode == 0


def first_failure(path: pathlib.Path) -> str:
    env = dict(os.environ, SAMEPAGE_CONTRACT=str(path))
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests", "-q", "-x", "-p", "no:cacheprovider", "-rf"],
        cwd=ROOT, env=env, capture_output=True, text=True,
    )
    for line in result.stdout.splitlines():
        if line.startswith("FAILED "):
            return line[len("FAILED "):].split(" - ")[0]
    return "error"


def main() -> int:
    source = CONTRACT.read_text(encoding="utf-8")
    assert run(CONTRACT), "the suite must pass against the real contract first"
    rows = []
    escaped = []
    with tempfile.TemporaryDirectory() as tmp:
        target = pathlib.Path(tmp) / "samepage.py"
        for name, before, after in MUTATIONS:
            count = source.count(before)
            if count != 1:
                print(f"mutation {name!r}: original text occurs {count} times")
                return 2
            target.write_text(source.replace(before, after), encoding="utf-8")
            caught_by = first_failure(target)
            if caught_by == "error" and run(target):
                escaped.append(name)
            rows.append((name, caught_by))
    if escaped:
        print("ESCAPED, no table printed:")
        for name in escaped:
            print("  " + name)
        return 1
    print(f"| # | mutation | caught by |\n| --- | --- | --- |")
    for i, (name, test) in enumerate(rows, 1):
        print(f"| {i} | {name} | `{test}` |")
    print(f"\n{len(rows)} mutations, none escaped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
