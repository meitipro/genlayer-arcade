"""
Rule 15: the deployment is the submission. Read the contract back from the
chain and compare it with contracts/unban.py. Line endings and a trailing
newline are reported as cosmetic; anything else is a material mismatch.

Run: python scripts/verify_source.py
"""

from __future__ import annotations

import hashlib
import sys

from chain import CONTRACT, Chain, load_deployment, retry


def main() -> int:
    record = load_deployment()
    client = Chain().client
    deployed = retry("gen_getContractCode", client.provider.make_request, method="gen_getContractCode",
                     params=[record["address"]])
    text = deployed.get("result") if isinstance(deployed, dict) else deployed
    if isinstance(text, str) and not text.lstrip().startswith("#"):
        import base64

        try:
            text = base64.b64decode(text).decode("utf-8")
        except Exception:  # noqa: BLE001
            pass
    local = CONTRACT.read_text(encoding="utf-8")
    if text == local:
        print(f"identical, sha256 {hashlib.sha256(local.encode()).hexdigest()}")
        return 0
    if isinstance(text, str) and text.replace("\r\n", "\n").rstrip("\n") == local.rstrip("\n"):
        print("cosmetic difference only (line endings or trailing newline)")
        return 0
    print("MATERIAL MISMATCH between the deployed source and contracts/unban.py")
    return 1


if __name__ == "__main__":
    sys.exit(main())
