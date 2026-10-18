"""
Deploy contracts/samepage.py to Studio Next and record it.

    python scripts/deploy.py

1. Validates the file against the live runtime (gen_getContractSchemaForCode)
   before anything is sent, because a contract under the wrong runtime header
   can come back ACCEPTED and create nothing (rule 21).
2. Deploys from a fresh account funded by Studio's faucet. The deployer has no
   privileges in the contract, so its key dies with the run.
3. Reads the source back off the chain and compares it to the repository byte
   for byte (scripts/verify.py does the same, and lints the deployed bytes).
4. Writes deployments.json and chain/out/deploy.json.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import subprocess
import sys

from chain import CHAIN_ID, CONTRACT, DEPLOYMENTS, GEN, ROOT, Chain, address_url, deployments, fresh, rpc, save_json, tx_url
from verify import deployed_source, compare


def main() -> int:
    code = CONTRACT.read_text(encoding="utf-8").replace("\r\n", "\n")
    digest = hashlib.sha256(code.encode("utf-8")).hexdigest()
    print(f"contract {CONTRACT.relative_to(ROOT)}  {len(code.encode())} bytes  sha256 {digest}", flush=True)

    reader = Chain()
    schema = reader.client.get_contract_schema_for_code(code)
    methods = sorted((schema.get("methods") or {}).keys()) if isinstance(schema, dict) else []
    print(f"live runtime accepts it: {len(methods)} methods {methods}", flush=True)
    if len(methods) != 10:
        print("expected the ten methods of section 4; not deploying", flush=True)
        return 1

    print("accounts", flush=True)
    deployer = fresh("deployer")
    chain = Chain(deployer)
    if chain.fund(deployer.address, 100 * GEN) <= 0:
        print("the faucet credited nothing; not deploying", flush=True)
        return 1

    result = chain.deploy(code, [])
    address, tx = result["address"], result["tx"]
    print(f"deployed {address}\n  {tx_url(tx)}", flush=True)

    back = deployed_source(address)
    same, note = compare(code, back)
    print(f"source read back from the chain: {'MATCH' if same else 'MISMATCH'} {note}", flush=True)

    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    entry = {
        "network": "studio-next",
        "chain_id": CHAIN_ID,
        "address": address,
        "deploy_tx": tx,
        "explorer": address_url(address),
        "deploy_tx_url": tx_url(tx),
        "sha256": digest,
        "bytes": len(code.encode("utf-8")),
        "source_matches": same,
        "deployed_from_commit": commit,
        "deployed_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "deployer": deployer.address,
    }
    record = deployments()
    history = record.get("history", [])
    history.append(entry)
    save_json(DEPLOYMENTS, {"current": entry, "history": history})
    save_json(ROOT / "chain" / "out" / "deploy.json", entry)
    print(json.dumps(entry, indent=2), flush=True)
    return 0 if same else 1


if __name__ == "__main__":
    sys.exit(main())
