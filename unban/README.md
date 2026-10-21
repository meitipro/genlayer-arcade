# Unban

**Ban appeals, decided by the community's own rules.** An appeals court for Discord, Telegram or X communities on GenLayer Studio Next (chain 61997).

A community writes numbered rules and a penalty ladder once, lists its moderators and funds a compensation pool. A banned member appeals with a fee. A listed moderator answers with the rule cited, the penalty applied and the quoted messages; the member may reply once. GenLayer validators then rule from the written rules alone:

| Ruling | Meaning | Money | In the server |
|---|---|---|---|
| OVERTURNED | The evidence does not show the cited rule, or any written rule, broken | Fee back plus compensation | Bot lifts the ban |
| REDUCED · Pn | A rule was broken, but the ladder sets a lighter penalty | Fee back | Bot replaces the ban with the ladder's level |
| UPHELD | The cited rule was broken and the penalty fits the ladder | Fee to the pool | Ban stays |
| DEFAULTED | No moderator answered in the response window | Fee back plus compensation | Bot lifts the ban, never judged |

- Site: https://use-unban.vercel.app (pages `/`, `/courts`, `/rulings`, `/c/[id]`, `/c/[id]/appeal`, `/a/[id]`, `/new`, `/mod`)
- Docs: https://use-unban.vercel.app/docs, plus `/llms.txt` and `/llms-full.txt`
- Build spec: `docs/Unban-GenLayer-Build-Spec.pdf`

## Repository

```
contracts/unban.py         one contract, twelve methods, the judge prompt pinned inside
tests/direct/              the real contract against a GenVM test double, model mocked
eval/golden.json           9 golden cases with expected rulings + 3 held out (H1-H3)
eval/run_golden.py         runs them through real consensus, writes eval/results.md
scripts/chain.py           the Studio Next client (fees, top-level payouts, honest receipts)
scripts/deploy.py          validate against the live runtime, deploy, write deployed.json
scripts/e2e.py             the reviewer's path, every step with its transaction link
scripts/seed.py            one realistic court with a mix of rulings
scripts/mutate.py          breaks 22 defences one at a time; every one must be caught
bot/                       read-only Discord bot: polls list_appeals, holds no wallet key
web/                       Next.js 16 site and Fumadocs /docs, genlayer-js 2.0.0-rc.1
submission/                portal text, X post, silent demo script, 512 px logo, screenshots
```

## The contract

`contracts/unban.py` runs on `py-genlayer:5jycge4q…`, the runtime Studio Next loads, with the header, imports and API names copied from the Recourse Studio Next port.

| Method | Kind | |
|---|---|---|
| `open_court(name, rules, ladder, mods, appeal_fee, compensation, response_hours)` | payable | rules, ladder, moderators and first pool funding |
| `update_court(court_id, rules, ladder, mods)` | write | owner only, refused while appeals are open, applies to later bans |
| `fund(court_id)` | payable | tops up the pool |
| `appeal(court_id, case_ref, banned_on, statement)` | payable | exact fee, reserves compensation |
| `respond(appeal_id, rule, level, evidence)` | write | a listed moderator, inside the window |
| `reply(appeal_id, text)` | write | the member, once, within 24 h |
| `judge(appeal_id)` | write, nondet | rules and settles into balances |
| `default(appeal_id)` | write | no answer in the window: DEFAULTED |
| `withdraw(court_id)` | write, pays | top-level transfer of the caller's balance; an owner passing a court id also reclaims its unreserved pool |
| `get_court`, `get_appeal`, `list_appeals` | view | |

Section 2 rules enforced in code: at most 12 rules in 2,500 characters and 6 ladder levels; case 120, statement 1,000, evidence 1,500, reply 600 characters; one open appeal per case and one appeal per address per court every 7 days; response window 12 to 96 h; judge and default only move balances; withdraw is the only call that pays.

Validators compare `(verdict, level)` only. The normaliser rejects a REDUCED level that is not on the ladder or not lighter than the level applied, and every text in the prompt is fenced.

## Tests

```bash
python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
python -m pytest tests/direct -q        # 66 passed
python scripts/mutate.py                 # 22/22 mutants caught
genvm-lint lint contracts/unban.py       # Lint passed
cd bot && npm test                       # 6 passed
cd web && npm install && npm run build   # docs generated, links checked, 25 routes
```

What the offline suite does **not** prove: anything about GenVM storage layout, calldata encoding or consensus. Those are proven only on chain, by `scripts/deploy.py`, `eval/run_golden.py` and `scripts/e2e.py`.

## On chain

See [`HANDOFF.md`](HANDOFF.md). The deploy, the golden cases and the end-to-end path are scripted and have **not been run yet**: the build environment could not reach `studio-next.genlayer.com`. No address, hash or verdict in this repository is invented; the docs pages for addresses and evaluation are generated from `deployed.json` and `eval/results.md` and say plainly when those do not exist.

```bash
python scripts/deploy.py      # validates against the runtime, deploys, writes deployed.json
python eval/run_golden.py     # 12 cases through real consensus -> eval/results.md
python scripts/e2e.py         # reviewer's path -> eval/e2e.md
python scripts/seed.py        # one realistic court for the site
```

Then set `NEXT_PUBLIC_UNBAN_CONTRACT` on the Vercel project and redeploy.
