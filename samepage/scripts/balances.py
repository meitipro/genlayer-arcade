"""
Read GEN balances back from the chain, for addresses named on the command line
or in chain/REQUEST.json, and record them with the time they were read.

    python scripts/balances.py 0xabc... 0xdef...
"""

from __future__ import annotations

import datetime
import sys

from chain import GEN, ROOT, Chain, current_address, save_json


def main(argv: list[str]) -> int:
    chain = Chain()
    address = current_address()
    rows = {}
    for who in argv:
        rows[who] = {
            "wallet_wei": str(chain.balance(who)),
            "in_contract_wei": chain.read_json(address, "list_pages", [who, 0, 1])["balance"],
        }
        print(f"{who}: wallet {int(rows[who]['wallet_wei']) / GEN:.6f} GEN, in Samepage {int(rows[who]['in_contract_wei']) / GEN:.6f} GEN")
    rows["_contract"] = {"wallet_wei": str(chain.balance(address))}
    rows["_read_at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    save_json(ROOT / "chain" / "out" / "balances.json", rows)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
