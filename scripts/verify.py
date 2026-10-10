#!/usr/bin/env python3
"""
Diff the deployed source against the repository.

For each contract in contracts/FROZEN.json: read the code back off the chain
with gen_getContractCode, compare its sha256 with the one recorded at deploy
time and with the file in contracts/ now, and validate the returned bytes
against the live runtime with gen_getContractSchemaForCode.

    python scripts/verify.py

Exit code 0 only when every deployed contract matches its file byte for byte.
"""

from __future__ import annotations

import base64
import hashlib
import sys

import chain as C

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def deployed_source(chain: C.Chain, address: str) -> str:
    raw = C.retry("gen_getContractCode", chain.client.provider.make_request, "gen_getContractCode", [address])
    value = raw.get("result", raw) if isinstance(raw, dict) else raw
    if isinstance(value, dict):
        value = value.get("code") or value.get("result") or ""
    if isinstance(value, str):
        try:
            return base64.b64decode(value, validate=True).decode("utf-8")
        except Exception:  # noqa: BLE001
            return value
    if isinstance(value, (bytes, bytearray)):
        return bytes(value).decode("utf-8", "replace")
    return str(value)


def main() -> int:
    entry = C.deployment()
    chain = C.Chain()
    bad = 0
    for name, path in C.CONTRACTS.items():
        rec = entry.get(name)
        if not rec:
            print(f"  {name}: not deployed")
            bad += 1
            continue
        src = deployed_source(chain, rec["address"])
        on_chain = hashlib.sha256(src.encode("utf-8")).hexdigest()
        in_repo = C.sha256_file(path)
        same_bytes = on_chain == rec["sha256"] == in_repo
        cosmetic_only = not same_bytes and src.replace("\r\n", "\n").rstrip() == path.read_text(encoding="utf-8").replace("\r\n", "\n").rstrip()
        try:
            schema = C.retry("schema", chain.client.get_contract_schema_for_code, src)
            methods = len(schema.get("methods", {}))
            lint = f"valid on the live runtime ({methods} methods)"
        except Exception as error:  # noqa: BLE001
            lint = f"INVALID on the live runtime: {str(error)[:120]}"
            bad += 1
        verdict = "MATCH" if same_bytes else ("COSMETIC DIFF" if cosmetic_only else "MATERIAL DIFF")
        if not same_bytes:
            bad += 1
        print(f"  {name:17} {rec['address']}  {verdict}  sha256 {on_chain[:16]}  {lint}")
    print("all deployed contracts match their files" if not bad else f"{bad} problem(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
