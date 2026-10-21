# Handoff: what only you can do

The build environment's network policy blocked `studio-next.genlayer.com`, `explorer-studio-dev.genlayer.com` and `*.vercel.app`, so nothing was sent to the chain from it. Everything else is built, tested and deployed. To finish:

1. **Deploy the contract** (about 2 minutes):
   ```bash
   pip install -r requirements.txt
   python scripts/deploy.py
   ```
   It validates `contracts/unban.py` against the live runtime first and refuses to deploy unless it reports exactly 12 methods. Test keys go to `.accounts.json` (git-ignored, never printed).
2. **Set the address on Vercel**: project `use-unban`, environment variable `NEXT_PUBLIC_UNBAN_CONTRACT` = the address `deploy.py` printed, then redeploy.
3. **Produce the evidence**:
   ```bash
   python scripts/e2e.py         # eval/e2e.md: every step with its explorer link
   python eval/run_golden.py     # eval/results.md: 12 rulings with transactions
   python scripts/seed.py        # a realistic court for the landing page
   ```
   Commit `deployed.json`, `eval/` and push; the docs regenerate the addresses and evaluation pages from them at the next build.
4. **Portal fields that need the chain**: contract link (`https://explorer-studio-dev.genlayer.com/address/<address>`) and the demo video (`submission/DEMO.md`). Everything else is in `submission/PORTAL.md`.
