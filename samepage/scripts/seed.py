"""
Seed the live contract with what the site's front page and the demo show:

  agreed   Kiln and Sera, the spec's demo deal: round 1 is checked, round 2 is
           written to agree, both sign, 20 GEN deposits each.
  round2   A logo gig checked once and left in round 2, with a 96 hour window
           so the page still reads as live the day after (rule 27).
  noshow   A page whose counterparty joins and then never seals. Settled later
           by scripts/no_show.py, after its 6 hour window.

Everything is read back from get_page and written to chain/out/seed.json, which
web/scripts/generate.mjs turns into lib/seed.json for the landing page. Every
result is what the chain said; nothing is assumed about how a check comes out.

    python scripts/seed.py
"""

from __future__ import annotations

import datetime
import json
import sys

from chain import GEN, ROOT, current_address, fresh, save_json, tx_url
from flow import Side, check, join, open_page, write_round

OUT = ROOT / "chain" / "out" / "seed.json"

KILN_1 = "Sera writes 3 posts and a thread on X about the Kiln launch, all live by Oct 24. Kiln pays 600 USDC, all of it after the last post is live."
SERA_1 = "I write 3 posts on X about the Kiln launch, all live by Oct 24, for 600 USDC: half before I start and half after the last post."
KILN_2 = "Sera writes 3 posts and one thread on X about the Kiln launch, all live by Oct 24. Kiln pays 600 USDC, half before Sera starts and half after the thread is live. Kiln may repost and quote them."
SERA_2 = "I write three posts and one thread on X about Kiln's launch, all live by Oct 24, for 600 USDC: half before I start and half after the thread is live. Kiln can repost and quote them."

LOGO_A = "Mina designs a logo for Kiln: 3 concepts, then the final mark as SVG and PNG with the source files. 300 USDC, half upfront, half on the final files, by Oct 30."
LOGO_B = "A logo for Kiln, 300 USDC paid when the final PNGs are delivered, by Oct 30. Two concepts to choose from."


def now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> int:
    address = current_address()
    record = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    record["contract"] = address
    txs: dict[str, str] = record.setdefault("tx", {})

    def note(key: str, outcome: dict) -> None:
        txs[key] = outcome["hash"]
        save_json(OUT, record)
        print(f"  {key:28} {tx_url(outcome['hash'])}", flush=True)

    print("accounts", flush=True)
    kiln = Side("kiln", fresh("kiln"))
    sera = Side("sera", fresh("sera"))
    mina = Side("mina", fresh("mina"))
    client = Side("client", fresh("client"))
    for side in (kiln, sera, mina, client):
        side.chain.fund(side.address, 120 * GEN)

    # -- agreed --------------------------------------------------------------
    page, outcome = open_page(kiln, address, "Kiln launch posts", sera.address, 20 * GEN, 48)
    note("agreed.open_page", outcome)
    note("agreed.join", join(sera, address, page, 20 * GEN))
    for k, o in write_round(kiln, sera, address, page, 1, KILN_1, SERA_1).items():
        note(f"agreed.r1.{k}", o)
    note("agreed.r1.check", check(kiln, address, page))
    row = kiln.chain.read_json(address, "get_page", [page])
    print(f"  round 1: {row['rounds'][0]['verdict']} {row['rounds'][0]['statuses']}", flush=True)
    if row["step"] == "SEALING":
        for k, o in write_round(kiln, sera, address, page, 2, KILN_2, SERA_2).items():
            note(f"agreed.r2.{k}", o)
        note("agreed.r2.check", check(sera, address, page))
        row = kiln.chain.read_json(address, "get_page", [page])
        print(f"  round 2: {row['rounds'][1]['verdict']} {row['rounds'][1]['statuses']}", flush=True)
    if row["step"] == "SIGNING":
        note("agreed.sign.kiln", kiln.chain.send(address, "sign", [page]))
        note("agreed.sign.sera", sera.chain.send(address, "sign", [page]))
        for side in (kiln, sera):
            note(f"agreed.withdraw.{side.label}", side.chain.send(address, "withdraw", [], finalized=True))
    row = kiln.chain.read_json(address, "get_page", [page])
    record["agreed"] = {"id": page, "page": row}
    save_json(OUT, record)
    print(f"  page #{page} is {row['step']}", flush=True)

    # -- round 2 -------------------------------------------------------------
    page, outcome = open_page(client, address, "Logo for Kiln", mina.address, 5 * GEN, 96)
    note("round2.open_page", outcome)
    note("round2.join", join(mina, address, page, 5 * GEN))
    for k, o in write_round(client, mina, address, page, 1, LOGO_B, LOGO_A).items():
        note(f"round2.r1.{k}", o)
    note("round2.r1.check", check(mina, address, page))
    row = mina.chain.read_json(address, "get_page", [page])
    record["round2"] = {"id": page, "page": row}
    save_json(OUT, record)
    print(f"  page #{page} round 1: {row['rounds'][0]['verdict']} {row['rounds'][0]['statuses']}, now {row['step']}", flush=True)

    # -- no-show -------------------------------------------------------------
    page, outcome = open_page(kiln, address, "OTC 40k ARB for USDC", sera.address, 10 * GEN, 6)
    note("noshow.open_page", outcome)
    note("noshow.join", join(sera, address, page, 10 * GEN))
    note("noshow.seal.kiln", kiln.chain.send(address, "seal", [page, "ab" * 32]))
    row = kiln.chain.read_json(address, "get_page", [page])
    record["noshow"] = {"id": page, "page": row, "settle_after": row["deadline"], "present": kiln.address, "absent": sera.address}
    record["recorded_at"] = now()
    save_json(OUT, record)
    print(f"  page #{page}: sera never seals; settle after {row['deadline']}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
