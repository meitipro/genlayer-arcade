# Progress

- Contract `contracts/unban.py`: 12 methods, rubric word for word, reserve on filing, frozen versioned rules, top-level withdraw. Lint passed; a back-port to the 1jb45 runner validates with 12 methods.
- `tests/direct`: 66 passed. `scripts/mutate.py`: 22/22 caught (the first run found a surviving mutant, a REDUCED level heavier than the one applied; a test was added and the validator now disagrees instead of raising when its own model run fails).
- Scripts: deploy, golden runner, e2e, seed, on genlayer-py 0.19.0rc2 with the Recourse Studio Next fee rules.
- Site: six pages + courts and rulings lists, wallet flow with fee shown before signing, wrong-network, faucet, validators-reviewing, refusal-with-retry and empty states. Builds on Next 16 with 25 routes.
- Docs: Fumadocs, 15 pages in four groups, contract reference / errors / judge prompt generated from the source, local Cmd+K search, llms.txt and llms-full.txt, broken internal links fail the build.
- Bot: read-only, 6 tests passed.
- Submission: portal text with checked lengths, X post, demo script, 512 px logo, screenshots.
- Blocked: chain access from the build environment (see HANDOFF.md).
