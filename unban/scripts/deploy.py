#!/usr/bin/env python3
"""
Deploy contracts/unban.py to Studio Next and record where it lives.

    python scripts/deploy.py

Validates the code against the live runtime first (gen_getContractSchemaForCode),
so a header the runtime refuses fails here and not as an ACCEPTED deploy that
created nothing. Funds the deployer from Studio's faucet, judged by its balance,
then deploys with the SDK's fee estimate and writes deployed.json, which every
other script and the site's NEXT_PUBLIC_UNBAN_CONTRACT read.
"""

from __future__ import annotations

import hashlib
import sys
import time

sys.path.insert(0, __import__("pathlib").Path(__file__).resolve().parent.as_posix())

from chain import CHAIN_ID, CONTRACT, EXPLORER, GEN, RPC, Chain, address_url, load_accounts, retry, save_deployment, tx_url  # noqa: E402


def main() -> None:
    accounts = load_accounts(["owner"])
    owner = accounts["owner"]
    chain = Chain(owner)
    code = CONTRACT.read_text(encoding="utf-8")
    digest = hashlib.sha256(code.replace("\r\n", "\n").encode()).hexdigest()
    print(f"contracts/unban.py sha256 {digest}")

    schema = retry("schema for code", chain.client.get_contract_schema_for_code, code)
    methods = sorted((schema.get("methods") or {}).keys()) if isinstance(schema, dict) else []
    print(f"runtime accepts it: {len(methods)} methods {methods}")
    if len(methods) != 12:
        raise SystemExit("expected exactly 12 methods; refusing to deploy")

    if chain.balance(owner.address) < 50 * GEN:
        chain.fund(owner.address, 200 * GEN)
    address, tx = chain.deploy(CONTRACT, [])
    print(f"Unban -> {address}\n  {address_url(address)}\n  deploy tx {tx_url(tx)}")
    save_deployment({
        "network": "studio-next",
        "chain_id": CHAIN_ID,
        "rpc": RPC,
        "explorer": EXPLORER,
        "contract": address,
        "deploy_tx": tx,
        "deployer": owner.address,
        "sha256": digest,
        "deployed_at": int(time.time()),
    })
    print("wrote deployed.json; set NEXT_PUBLIC_UNBAN_CONTRACT to the address above on Vercel")


if __name__ == "__main__":
    main()
