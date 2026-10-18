"""
Read the deployed source back off the chain, diff it against the repository,
and lint the bytes that came back rather than the file on disk (rule 15).

    python scripts/verify.py [address]

Line endings and a trailing newline are cosmetic and reported as such; any
other difference is material and fails.
"""

from __future__ import annotations

import base64
import hashlib
import os
import pathlib
import subprocess
import sys
import tempfile

from chain import CONTRACT, ROOT, current_address, rpc, save_json


def deployed_source(address: str) -> str:
    last = None
    for _ in range(8):
        answer = rpc("gen_getContractCode", [address])
        if answer.get("result"):
            return base64.b64decode(answer["result"]).decode("utf-8")
        last = answer
    raise RuntimeError(f"gen_getContractCode gave no code: {str(last)[:200]}")


def compare(repo: str, chain: str) -> tuple[bool, str]:
    if repo == chain:
        return True, "byte for byte"
    a = repo.replace("\r\n", "\n").rstrip("\n")
    b = chain.replace("\r\n", "\n").rstrip("\n")
    if a == b:
        return True, "differs only in line endings or the trailing newline"
    for n, (x, y) in enumerate(zip(a.split("\n"), b.split("\n")), 1):
        if x != y:
            return False, f"first difference on line {n}: repo {x[:60]!r} chain {y[:60]!r}"
    return False, "one is a prefix of the other"


def lint(code: str) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp) / "deployed_samepage.py"
        path.write_text(code, encoding="utf-8")
        env = dict(os.environ, PYTHONIOENCODING="utf-8", GENVM_VERSION=os.environ.get("GENVM_VERSION", "v0.6.0-rc5"))
        out = []
        for verb in ("lint", "validate"):
            result = subprocess.run(["genvm-lint", verb, str(path)], capture_output=True, text=True, env=env)
            last = [line for line in (result.stdout + result.stderr).splitlines() if line.strip() and "Downloading" not in line]
            out.append(f"{verb}: exit {result.returncode} {' / '.join(last[-3:])}")
            if result.returncode != 0:
                raise SystemExit("\n".join(out))
        return "\n".join(out)


def main() -> int:
    address = sys.argv[1] if len(sys.argv) > 1 else current_address()
    repo = CONTRACT.read_text(encoding="utf-8")
    chain = deployed_source(address)
    same, note = compare(repo, chain)
    print(f"{address}: {'MATCH' if same else 'MISMATCH'} ({note})")
    print(f"  repo  sha256 {hashlib.sha256(repo.encode()).hexdigest()}  {len(repo.encode())} bytes")
    print(f"  chain sha256 {hashlib.sha256(chain.encode()).hexdigest()}  {len(chain.encode())} bytes")
    report = lint(chain)
    print("  genvm-lint over the deployed bytes:\n  " + report.replace("\n", "\n  "))
    save_json(ROOT / "chain" / "out" / "verify.json", {
        "address": address, "match": same, "note": note,
        "repo_sha256": hashlib.sha256(repo.encode()).hexdigest(),
        "chain_sha256": hashlib.sha256(chain.encode()).hexdigest(),
        "lint": report,
    })
    return 0 if same else 1


if __name__ == "__main__":
    sys.exit(main())
