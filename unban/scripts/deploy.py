"""
Deploy contracts/unban.py to Studio Next.

1. Validate the file against the live runtime (gen_getContractSchemaForCode)
   before spending anything: a wrong header can deploy as ACCEPTED and create
   nothing.
2. Deploy with the SDK fee estimate, wait for finality, and read the schema
   back from the new address.
3. Write deployment.json (address, deploy tx, source sha256, commit), which
   the site, the bot and every script read.

Run: python scripts/deploy.py
"""

from __future__ import annotations

import datetime
import hashlib
import subprocess

from chain import CHAIN_ID, CONTRACT, GEN, RPC, Chain, accounts, explorer_address, explorer_tx, save_deployment


def main() -> None:
    keys = accounts(["deployer"])
    deployer = Chain(keys["deployer"])
    print(f"deployer {keys['deployer'].address}", flush=True)
    if deployer.balance(keys["deployer"].address) < 10 * GEN:
        deployer.fund(keys["deployer"].address, 100 * GEN)

    code = CONTRACT.read_text(encoding="utf-8")
    schema = deployer.schema_for_code(code)
    methods = sorted((schema.get("methods") or {}).keys()) if isinstance(schema, dict) else []
    print(f"live runtime accepts the file: {len(methods)} methods {methods}", flush=True)

    deployed = deployer.deploy(CONTRACT, [])
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except Exception:  # noqa: BLE001
        commit = ""
    record = {
        "network": "studio-next",
        "chain_id": CHAIN_ID,
        "rpc": RPC,
        "address": deployed["address"],
        "deploy_tx": deployed["hash"],
        "source_sha256": hashlib.sha256(code.encode("utf-8")).hexdigest(),
        "deployed_from_commit": commit,
        "deployed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    }
    save_deployment(record)
    print(f"Unban at {explorer_address(deployed['address'])}", flush=True)
    print(f"deploy tx {explorer_tx(deployed['hash'])}", flush=True)


if __name__ == "__main__":
    main()
