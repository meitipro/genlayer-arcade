# Handoff: what only the owner can do

Everything else is done and recorded in `PROGRESS.md`. These need an account login, which this session does not have.

## 1. A public URL on Vercel (one minute)

This session's Vercel token can trigger git deployments but cannot create a project, add an alias, change a project setting or start a sandbox (each answered 403). Samepage is therefore deployed as the branch preview of the existing `genlayergamehub` project, which serves it correctly:

`https://genlayergamehub-git-claude-project-dep-a7433e-mahdighs-projects.vercel.app`

That project has Vercel Authentication on its previews, so a visitor who is not logged in to the team is asked to log in. Pick one:

- **Recommended, a dedicated project:** Vercel, Add New, Project, import `meitipro/genlayer-arcade`, set **Root Directory** to `samepage/web`, Framework **Other** (it reads `samepage/web/vercel.json`), Production Branch `claude/project-deploy-test-t7j87s`, Deploy. No environment variables are needed. You get a public `*.vercel.app` URL.
- **Or:** in `genlayergamehub`, Settings, Deployment Protection, set Vercel Authentication to off (or "Only Production Deployments" is not enough; it protects previews). This makes every preview of the arcade public too.

## 2. A dedicated GitHub repository (optional)

This session's GitHub integration cannot create repositories (403), so Samepage lives in `samepage/` of `meitipro/genlayer-arcade`, branch `claude/project-deploy-test-t7j87s`. Moving it is copying this folder and `.github/workflows/samepage-chain.yml`.

## 3. Do not merge this branch into the arcade's main

The root `vercel.json` and `.vercelignore` on this branch make the arcade's Vercel project build Samepage instead of the arcade. `scripts/vercel-guard.mjs` fails a production build, so a merge could not replace the live arcade, but the arcade's own `vercel.json` (with its crons) would need restoring.
