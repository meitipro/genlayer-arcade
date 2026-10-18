# Handoff: what only the owner can do

- **A dedicated GitHub repository.** This session's GitHub integration cannot create repositories (403), so Samepage lives in `samepage/` of `meitipro/genlayer-arcade`, branch `claude/project-deploy-test-t7j87s`. Moving it is a copy of this folder.
- **A dedicated Vercel project.** This session's Vercel token cannot create projects, aliases or sandboxes (403). The branch's preview on the existing `genlayergamehub` project builds Samepage (see the root `vercel.json` on this branch); the production build of that project refuses to build Samepage, so the arcade's production stays the arcade. For a public URL: Vercel, Add New Project, import `meitipro/genlayer-arcade`, Root Directory `samepage/web`, Framework Next.js. No environment variables are needed.
