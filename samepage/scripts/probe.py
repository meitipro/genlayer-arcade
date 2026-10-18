"""
What the browser and the scripts can count on from Studio Next, measured: the
chain id, whether the RPC answers a cross-origin browser, and the faucet.
"""

from __future__ import annotations

import requests

from chain import RPC, save_json, ROOT


def main() -> None:
    out = {}
    out["chain_id"] = requests.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": "eth_chainId", "params": []}, timeout=30).json()
    pre = requests.options(RPC, headers={
        "Origin": "https://samepage.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }, timeout=30)
    out["cors_preflight"] = {"status": pre.status_code, "headers": {k: v for k, v in pre.headers.items() if k.lower().startswith("access-control")}}
    post = requests.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []},
                         headers={"Origin": "https://samepage.example"}, timeout=30)
    out["cors_post"] = {"status": post.status_code, "allow_origin": post.headers.get("access-control-allow-origin")}
    save_json(ROOT / "chain" / "out" / "probe.json", out)
    print(out)


if __name__ == "__main__":
    main()
