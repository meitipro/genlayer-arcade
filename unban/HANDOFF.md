# Handoff: what only the owner can unblock

Everything that does not need the network is built and tested. These steps need hosts this build environment could not reach.
Nothing below has been run, and no address, hash or ruling has been written anywhere as if it had.

## Rechecked on 2026-10-19

| Check | Result |
| --- | --- |
| `eth_chainId` on `https://studio-next.genlayer.com/api` | **blocked**: the session's egress proxy answered 403 to CONNECT (`connect_rejected`) |
| `explorer-studio-dev.genlayer.com`, `use-unban.vercel.app` | **blocked** the same way, so no explorer link could be opened from here |
| Vercel: list team `mahdighs-projects` | works |
| Vercel: create project `use-unban` (both `POST /v11/projects` and the Git-linked create) | **403 forbidden**: "You don't have permission to create the project." No project named `use-unban` exists yet |
| `python -m pytest tests -q` | 64 passed |
| `GENVM_VERSION=v0.6.0-rc6 genvm-lint check contracts/unban.py` | lint passed, validation passed, 12 methods (3 view, 9 write) |
| `npm ci && npm run build` in `web/` | passes, 29 static pages |

What only you can do:

0. **Unban's own repository (do this first).** Unban is a separate project, not part of the arcade. GitHub refused to let
   this session create a repository (`POST /user/repos`: 403 "Resource not accessible by integration"). Create an **empty**
   public repository `meitipro/genlayer-unban` at https://github.com/new (no README, no license, no .gitignore), and give the
   Claude GitHub app access to it (https://github.com/apps/claude/installations/select_target). Then either ask a session to
   push it, or from a clone of this branch run:

   ```bash
   git subtree split -P unban -b unban-only
   git push https://github.com/meitipro/genlayer-unban.git unban-only:main
   ```

   The code already points at that repository: the site's GitHub links, Edit on GitHub in the docs, the contract source
   links and the portal's GitHub field all read `github.com/meitipro/genlayer-unban` (branch `main`, Unban at the root).
1. **Network access.** In the cloud environment's settings (environment menu, Edit, Network access), allow
   `studio-next.genlayer.com` and `explorer-studio-dev.genlayer.com`, and `*.vercel.app` if the live site should be tested
   from a session. Or run section 1 below on your own machine.
2. **Vercel permission.** The Vercel connection can read team `mahdighs-projects` but not create projects in it. Either give
   that connection a role that can create projects (Owner or Member), or do section 2 below in the dashboard yourself.

Nothing below has been run since: no address, hash, verdict or score was produced or written.

## 1. Network access (blocking deploy, golden run, seed, walk)

The build session's network policy answered 403 for `studio-next.genlayer.com`, `explorer-studio-dev.genlayer.com` and
`vercel.com`. Allow those hosts (or run the commands below on your own machine):

```bash
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

1. https://vercel.com/new, import `meitipro/genlayer-unban`. Project name `use-unban` (the site is then https://use-unban.vercel.app), Root Directory `web`
   (Edit, pick the folder), framework Next.js, leave the build settings as they are. Deploy.
2. Production Branch stays `main`. Settings, Advanced: Skew Protection off.
3. Open the site when the first deployment is Ready.
4. Open `/run` on the site and press Run. It deploys the contract with a throwaway test account, walks the reviewer's path,
   runs the 12 golden cases through consensus and seeds two courts (about 30 to 45 minutes, keep the tab open).
5. Settings, Environment Variables: `NEXT_PUBLIC_UNBAN_CONTRACT` = the address `/run` shows, for Production. Optional:
   `NEXT_PUBLIC_SITE_URL` = the site's URL. Then Deployments, Redeploy.
6. Download deployment.json, results.json, walk.json and seed.json from `/run` and commit them as `deployment.json`,
   `eval/results.json`, `evidence/walk.json`, `evidence/seed.json` at the root of `genlayer-unban`. The next build puts them in the docs
   (Evaluation, Addresses), and then the environment variable is no longer needed. The "Links for the portal form" box on
   `/run` has every link the form asks for.

## 3. A repository of its own

See step 0 above. Until `meitipro/genlayer-unban` exists, the only copy is `unban/` on branch
`claude/inspiring-dijkstra-6cskv8` of `meitipro/genlayer-arcade`, kept there only as a staging area. Once it has moved,
that branch can be deleted; nothing in the arcade depends on it. The folder carries its own `.gitignore`, so the keys file
stays ignored after the split.

## 4. Demo video

`submission/DEMO.md` is the silent script. Record it once the deployment and seed exist.
