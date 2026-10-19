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

## 2. Vercel, then everything else from the browser

1. https://vercel.com/new, import `meitipro/genlayer-arcade`. Project name `genlayer-unban`, Root Directory `unban/web`
   (Edit, pick the folder), framework Next.js, leave the build settings as they are. Deploy.
2. Settings, Git, Production Branch: `claude/inspiring-dijkstra-6cskv8`. Settings, Advanced: Skew Protection off.
3. Deployments, the latest one, Redeploy, so production is built from that branch. Open the site.
4. Open `/run` on the site and press Run. It deploys the contract with a throwaway test account, walks the reviewer's path,
   runs the 12 golden cases through consensus and seeds two courts (about 30 to 45 minutes, keep the tab open).
5. Settings, Environment Variables: `NEXT_PUBLIC_UNBAN_CONTRACT` = the address `/run` shows, for Production. Optional:
   `NEXT_PUBLIC_SITE_URL` = the site's URL. Then Deployments, Redeploy.
6. Download deployment.json, results.json, walk.json and seed.json from `/run` and commit them as `unban/deployment.json`,
   `unban/eval/results.json`, `unban/evidence/walk.json`, `unban/evidence/seed.json`. The next build puts them in the docs
   (Evaluation, Addresses), and then the environment variable is no longer needed. The "Links for the portal form" box on
   `/run` has every link the form asks for.

## 3. A repository of its own

The GitHub integration could not create `meitipro/genlayer-unban` (403). The project lives in `unban/` of this branch and is
self-contained; to move it: `git subtree split -P unban -b unban-only` and push that branch to a new repository.

## 4. Demo video

`submission/DEMO.md` is the silent script. Record it once the deployment and seed exist.
