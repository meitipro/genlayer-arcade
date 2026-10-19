"""Write submission/EVIDENCE.md from the records the runner committed under chain/out and eval/."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "chain" / "out"
EX = "https://explorer-studio-dev.genlayer.com"
tx = lambda h: f"[`{h[:10]}…{h[-6:]}`]({EX}/tx/{h})"
load = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8")) if (ROOT / p).exists() else None

dep = load("chain/out/deploy.json")
ver = load("chain/out/verify.json")
lines = ["# Evidence, every link read from the run records", "",
         "Every transaction below was sent by a script or a browser on a GitHub runner and is recorded in `chain/out/` or `eval/`. Nothing here was typed by hand.", "",
         "## Deployment", "",
         f"- Contract: [`{dep['address']}`]({EX}/address/{dep['address']}) on Studio Next, chain 61997",
         f"- Deploy transaction: {tx(dep['deploy_tx'])}, from commit `{dep['deployed_from_commit'][:7]}`",
         f"- Source read back from the chain: {'MATCH, byte for byte' if ver['match'] else 'MISMATCH'}; sha256 `{ver['chain_sha256']}`",
         f"- `genvm-lint` over the deployed bytes: {ver['lint'].replace(chr(10), '; ')}", ""]

res = load("eval/results.json")
gold = load("eval/golden.json")
lines += ["## Golden cases through real consensus", "", "| case | expected | statuses | result | check |", "| --- | --- | --- | --- | --- |"]
for c in gold["cases"]:
    e = res["cases"][c["id"]]
    ok = [a["tx"] for a in e["attempts"] if a.get("ok")]
    st = " · ".join(e["statuses"][t] for t in ["amount", "deliverable", "deadline", "payment", "rights", "cancellation"])
    r = "held out" if c["expected"] is None else ("pass" if e.get("pass") else "**miss**")
    lines.append(f"| {c['id']} | {c['verdict']} | {st} | {r} | {tx(ok[-1])} |")
lines.append("")

site = load("chain/out/site-e2e.json")
lines += ["## The reviewer's path through the site's signing code (page #%s)" % site["page"], "",
          "Fresh accounts, Studio faucet, every write through `web/lib/chain.ts`. Refusals are on chain on purpose.", ""]
for s in site["steps"]:
    note = f" refused: \"{s['refused']}\"" if s.get("refused") else ""
    if s.get("tx"):
        lines.append(f"- {s['name']}: {tx(s['tx'])}{note}")
for who, b in (site.get("balances") or {}).items():
    if "contract_paid_out" in b:
        lines.append(f"- {who} withdraw: the contract paid out {int(b['contract_paid_out']) / 10**18:g} GEN of {int(b['owed_in_contract']) / 10**18:g} owed, {'exact to the wei' if b['exact_to_the_wei'] else 'MISMATCH'}")
lines.append("")

br = load("chain/out/browser-e2e.json")
lines += ["## The full loop in a real browser (page #%s)" % br["page"], "",
          f"Two Playwright browser contexts with stand-in wallets signing through `window.ethereum`; round 1 came back {br['round1']}. Screenshots: `chain/out/screens/`.", ""]
for s in br["steps"]:
    if s.get("step") and s.get("tx"):
        lines.append(f"- {s['who']}: {s['step']}: {tx(s['tx'])}")
lines.append("")

seed = load("chain/out/seed.json")
lines += ["## Seeded pages", ""]
for key, label in (("agreed", "agreed in round 2"), ("round2", "left in round 2"), ("noshow", "counterparty never seals")):
    if seed.get(key):
        p = seed[key]["page"]
        lines.append(f"- Page #{seed[key]['id']} ({label}): now {p['step']}")
for k, h in seed["tx"].items():
    lines.append(f"  - {k}: {tx(h)}")
lines.append("")

ns = load("chain/out/no-show.json")
if ns:
    lines += ["## No-show settled", "", f"- Page #{ns['page']}: {ns['step_before']} -> {ns['step_after']}, absent {', '.join(ns['absent'])}, settled by a stranger in {tx(ns['tx'])}",
              f"- Balances inside the contract before {ns['balance_before']} and after {ns['balance_after']}",
              f"- A second settle refused: \"{ns['second_call_refused']}\" {tx(ns['second_call_tx'])}", ""]

bal = load("chain/out/balances.json")
if bal:
    lines += ["## Balances read back after finality (%s)" % bal["_read_at"], ""]
    for k, v in bal.items():
        if k.startswith("0x"):
            lines.append(f"- `{k}`: wallet {int(v['wallet_wei']) / 10**18:.6f} GEN, in Samepage {int(v['in_contract_wei']) / 10**18:.6f} GEN")
    lines.append("")

(ROOT / "submission" / "EVIDENCE.md").write_text("\n".join(lines), encoding="utf-8")
print("\n".join(lines)[:1500])
