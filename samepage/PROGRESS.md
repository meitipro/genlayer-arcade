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
