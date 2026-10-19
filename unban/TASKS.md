# Tasks

Build order from section 11 of the spec. Ticked means done and checked in this repository.

- [x] 1. `contracts/unban.py`, exactly 12 public methods; `tests/test_direct.py` covers every method and every rule in section 2 (64 tests, model mocked)
- [x] 1. Lint and validate against the `5jycge4q` runtime: `genvm-lint check` with GenVM v0.6.0-rc6, passed, 12 methods
- [x] 1. Mutation table: `scripts/mutate.py`, 32 mutations, none escaped (`tests/MUTATIONS.md`)
- [ ] 2. Deploy to Studio Next with genlayer-py 0.19.0rc2: `python scripts/deploy.py` (rechecked 2026-10-19: studio-next.genlayer.com still refused by the session's network policy, see HANDOFF.md)
- [x] 3. Golden set written and sealed before any run (`eval/golden.json`, `eval/golden.sha256`), runner `eval/run_golden.py`
- [ ] 3. Golden and held-out cases through real consensus (blocked here, see HANDOFF.md)
- [x] 4. `web/`: landing, courts, court, file an appeal, appeal, open a court, moderator desk, rulings, deploy; genlayer-js 2.0.0-rc.1
- [x] 5. `/docs` with Fumadocs: grouped sidebar, on this page, local Cmd+K search, breadcrumbs, prev/next, Edit on GitHub, last updated, copy buttons, tabs, callouts, Studio Next badge; contract reference, errors, judge prompt and addresses generated from source; `/llms.txt`, `/llms-full.txt`; build fails on a broken internal link
- [x] 6. `bot/` read-only Discord bot with tests; `scripts/seed.py`, `scripts/walk.py`, `scripts/verify_source.py`; README; `submission/`
- [ ] 6. Seed, walk the reviewer's path to finality, and fill the evidence links (blocked here, see HANDOFF.md)
- [ ] Move Unban to its own repository `meitipro/genlayer-unban` (GitHub refused to create it from this session; links already point there, see HANDOFF.md step 0)
- [ ] Deploy the site on Vercel as `use-unban` (rechecked 2026-10-19: the Vercel connection may read the team but gets 403 on project creation, see HANDOFF.md)
