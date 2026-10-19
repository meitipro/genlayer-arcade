# Progress

One line per step, newest last.

- Read the build spec (19 pages) and the 34 rules; pinned the Studio Next runtime header from the Recourse port (`py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`).
- `contracts/samepage.py`: the ten methods of section 4; `genvm-lint lint` and `validate` pass under GenVM v0.6.0-rc5 (10 methods, 2 view, 8 write).
- `tests/`: 100 direct and static tests through the GenVM double, judge mocked; shared seal vectors in `tests/vectors.json`.
- `scripts/mutate.py`: 41 mutations of the contract's defences, none escaping (two escapes on the first run became two new tests).
- `eval/golden.json` written and hashed in `eval/GOLDEN.lock`, committed before the first run.
- Studio Next is unreachable from the development container, so chain work runs on a GitHub runner (`.github/workflows/samepage-chain.yml`) and its results are committed back.
- Runner run 1: deployed `0x6654e80CA0656CC007991D073a274D1067F82999` (tx `0x582486af…`), source read back byte for byte, deployed bytes lint and validate; RPC answers browsers (CORS `*`).
- Golden run through real consensus: 8 of 9 scored cases on all six statuses (case 6, Persian, missed on payment), H1 to H3 held out; published in `eval/results.md`.
- `web/`: static Next.js export with genlayer-js 2.0.0-rc.1 and Fumadocs; every page of section 6, docs of section 7 with the contract reference, errors, addresses, judge prompt and evaluation generated from the repo; `/llms.txt`; internal link check in the build.
- Fixed a build that never exited: a stale `.next` from a build that had picked the arcade as the Turbopack root. The root is now pinned to `samepage/web`.
- Vercel: the branch preview on `genlayergamehub` serves Samepage. Two fixes: a `.vercelignore` keeps the arcade's root middleware out (every request had failed `MIDDLEWARE_INVOCATION_FAILED`), and the `/p/<id>` rewrites point at the clean URLs `/p` and `/record`.
- Runner run 3 lost its records: its commit step rebased a checkout the web build had dirtied. Fixed with `--autostash` and an artifact upload; the site's error line now carries the real cause.
- Runner run 4: seed (page #18 DIFFERENT then SAME PAGE, both signed and withdrew; #19 waiting in round 2; #20 no-show pending), the reviewer's path through `lib/chain.ts` (page #21, five refusals on chain, both withdrawals exact to the wei on the contract side), and the full loop in a real browser (page #22, 11 transactions signed in Playwright, screenshots in `chain/out/screens/`). The browser's one transient failure in run 3 was Studio's 30 requests a minute.
- Balances read back after finality: both site-run payees hold 99.999 GEN (100 funded, 20 deposited, 20 withdrawn, fees spent). The site run had read kiln's wallet before the payout showed; it now waits for the wallet too.
- UI: the page's side panel now sits beside the main column on desktop; the countdown says UTC.
- `submission/`: 512 px logo, portal text with every field under its limit, X post, silent demo script, `EVIDENCE.md` generated from the run records.
- No-show settled after its window (runner run 6): page #20 SEALING -> NO_SHOW, Sera recorded absent, both 10 GEN deposits (20 GEN) moved to Kiln's balance inside the contract, settled by a stranger in `0xc5b36977…`; a second settle refused with "this page is closed". Moving money here is balances only; Kiln's 20 GEN stays withdrawable by Kiln.
