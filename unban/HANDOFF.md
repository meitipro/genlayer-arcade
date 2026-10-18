# Handoff: what only the owner can unblock

Everything that does not need the network is built and tested. These steps need hosts this build environment could not reach.
Nothing below has been run, and no address, hash or ruling has been written anywhere as if it had.

## 1. Network access (blocking deploy, golden run, seed, walk)

The build session's network policy answered 403 for `studio-next.genlayer.com`, `explorer-studio-dev.genlayer.com` and
`vercel.com`. Allow those hosts (or run the commands below on your own machine):

```bash
cd unban
python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
python scripts/deploy.py          # validates against the live runtime, deploys, writes deployment.json
python scripts/verify_source.py   # the deployed source equals contracts/unban.py
python eval/run_golden.py         # 9 golden + 3 held-out cases through consensus, writes eval/results.json and results.md
python scripts/walk.py            # fresh accounts to finality, two refusals on chain, writes evidence/walk.json
python scripts/seed.py            # Kiln and Quill courts with waiting appeals for the desk
python scripts/seed.py --finish   # 12+ hours later: defaults the unanswered Quill appeal
git add deployment.json eval/results.* evidence/ && git commit -m "Deployment and evidence" && git push
```

`.accounts.json` holds the test keys and is ignored by git. Only addresses are printed.

## 2. Vercel

Create a project from `meitipro/genlayer-arcade`, branch `claude/inspiring-dijkstra-6cskv8`, root directory `unban/web`,
framework Next.js. No environment variable is required once `deployment.json` is committed; before that, set
`NEXT_PUBLIC_UNBAN_CONTRACT` to the address `/deploy` gives you. Optional: `NEXT_PUBLIC_SITE_URL`. Turn Skew Protection off.

## 3. A repository of its own

The GitHub integration could not create `meitipro/genlayer-unban` (403). The project lives in `unban/` of this branch and is
self-contained; to move it: `git subtree split -P unban -b unban-only` and push that branch to a new repository.

## 4. Demo video

`submission/DEMO.md` is the silent script. Record it once the deployment and seed exist.
