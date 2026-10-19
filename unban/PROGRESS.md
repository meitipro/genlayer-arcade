# Progress

- Contract written from the spec, runtime header and payout pattern copied from the Recourse Studio Next port.
- `genvm-lint check` (GenVM v0.6.0-rc6): lint passed, validation passed, 12 methods (3 view, 9 write).
- Direct tests: 64 passed. Two expectations in the first draft of the tests were wrong (four prompt blocks, not five; a model failure ends as a disagreement), the contract was not.
- Mutation testing: 32 defences broken one at a time, all caught.
- Golden set sealed (sha256 in `eval/golden.sha256`) before any run.
- Site and docs: `npm run build` passes, 28 routes; every page checked at 1280 px and 390 px with no horizontal overflow and no console errors.
- Bug pass: withdraw's reclaim loop now writes through an indexed storage view like every other write; court lists read at most 12 courts per cold page (RPC budget); the docs theme switch is gone because the site is dark only; the court form's add buttons no longer stretch.
- Bot: 3 tests pass.
- Blocked: the session's network policy refuses studio-next.genlayer.com and vercel.com, so nothing was deployed or sent on chain from here. See HANDOFF.md.
- 2026-10-19 recheck: 64 tests pass, `genvm-lint check` passes (12 methods), `npm ci && npm run build` passes (29 static pages).
  Studio Next and the explorer are still refused by the session's network policy (403 at the proxy), and the Vercel
  connection can list team `mahdighs-projects` but gets 403 when creating the `use-unban` project. So there is still no
  deployment, no golden score, no walk and no live site; nothing was invented to fill those gaps. See HANDOFF.md.
