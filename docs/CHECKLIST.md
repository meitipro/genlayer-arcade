# Section 21: test and launch checklist

Pass or fail per item, with the evidence. Run on 2026-10-10 against Studionet and https://genlayergamehub.vercel.app.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Phone, fresh browser: claim nickname, play all five arcade games, scores on every season board | **Partly** | A fresh nickname claimed on the live site, with scores accepted and ranked on all six season boards ([e2e-live.json](e2e-live.json), run 2). All pages measured at 375 px with no horizontal scroll. Game mechanics checked by bots in `tests/web/games.test.ts`. **Not done:** a person playing by hand on a physical phone. The browser pane used for checks was hidden most of the session, so the games were not watched being played. |
| 2 | curl score without token rejected; reused token rejected; impossible score rejected | **Pass** | live: 400 `bad session`, 409 `session used`, 422 `implausible score` (e2e run 2); also `tests/web/lib.test.ts` |
| 3 | Another device cannot post under your nickname | **Pass** | live: wrong secret answered 401 `bad player` |
| 4 | Verdict: submit, ACCEPTED, score and reason, explorer link; injection answer scores 0 | **Pass** | live: 9/10, ACCEPTED, 3 of 3 agree ([tx](https://explorer-studio.genlayer.com/tx/0xeac94a316714a333e08c416790a02f500eda0d4a675f2adeef6f531a8f8ac651)). Injection scored 0 through the local site (3 of 3 agree) and through the Studio script ([tx](https://explorer-studio.genlayer.com/tx/0x6da7fe547e6936af67db6865517194081b4e3ff73269bddc5301fd82f1fb22ad)) |
| 5 | Bridge: valid chain scores, invalid chain shows the failing link, wrong start word rejected instantly | **Pass** | valid `ocean salt pepper mill` = 85 ([tx](https://explorer-studio.genlayer.com/tx/0x62f131d5ea79722b10c012239cadceb0434c955327ba804fa90b0d5fb5324773)); live `moon sky pie` invalid with link 2 marked; a wrong start word was refused by the contract before any LLM call ([tx](https://explorer-studio.genlayer.com/tx/0xa00077446ae8addc66eb2369bd8e49b580c7590cb03a3aacc2078d5e6605fb0f)). The site's form fixes the start and end words, so a wrong start cannot be typed there |
| 6 | Oracle: guess, lock, resolve; answer within 1% of the source; ranking correct | **Pass** | four sources on chain (BTC 82959 vs 82959, Tehran 17 vs 17, ETH 2508 vs 2509, Dubai 32 vs 32); production round 1 locked and resolved through the admin path, answer 82951, ranked |
| 7 | Second daily submission same round blocked with a clear message | **Pass** | live: 409 `you already played this round` for Verdict and Bridge |
| 8 | Reload during a pending tx resumes polling | **Pass** | local site: reloaded during COMMITTING, polling resumed and showed ACCEPTED 9/10 |
| 9 | Admin: every action works; season finalized and visible on /seasons | **Pass** | open (live and local), close, lock, resolve, rollover, deadline, finalize-season, remove-score (live), tx, log. Finalize ran against a relayer-owned test ledger, and `/seasons` read it back ([admin-test.studionet.json](admin-test.studionet.json)). The production ledger records its first real season on Monday 2026-10-12 |
| 10 | No secret in .next/static | **Pass** | production build searched for the relayer key and the four generated secrets: none found |
| 11 | Each game page uses only its own accent; mute persists | **Pass** | game and daily pages set `--accent` for the whole document, header included; mute is kept in localStorage |
| 12 | Lighthouse mobile performance 85+, accessibility 95+, reduced motion respected | **Pass** | `/`: 99 / 100; `/play/validator-run`: 96 / 100; `/daily/verdict`: 91 / 100. `prefers-reduced-motion` disables CSS motion and shake, and limits particle bursts |
| 13 | OG card renders on X and Discord | **Not verified** | `/api/og/*` returns 1200x630 PNGs, and the `og:image` and `twitter:card` tags are set. It has not been pasted into X or Discord |
| 14 | README lists env vars, contract addresses, admin steps | **Pass** | [README.md](../README.md) |

## Day two: features added after the section 21 run

| Item | Result | Evidence |
|---|---|---|
| Community game submissions reviewed on-chain | **Pass on chain, not yet on the live site** | GameReview deployed and verified; 5 real pages judged as expected ([studio-tests.studionet.json](studio-tests.studionet.json)); 13 offline tests; 32/32 mutants |
| Tournament mode (rooms scope an event board) | **Pass offline** | `tests/web/features.test.ts`: unknown, upcoming and wrong-game rooms refused, a live room ranks the run on `lb:event:<id>` |
| Wallet mode for the dailies | **Pass against the local site with the real chain** | [wallet-e2e.json](wallet-e2e.json): faucet, wallet-sent submit, hub verified and recorded it, ACCEPTED 3 of 3, entry read back. **Not tried with a real browser wallet** |
| UNDETERMINED teaser level | **Pass** | `tests/web/teaser.test.ts`: a beam search over a person's moves finishes it with no fall |
| Five new arcade games (Sky Hop, Fee Flap, Whack-a-Node, Node Defender, Stake Merge) | **Pass in bot tests, not played by hand** | `tests/web/games2.test.ts`: seeded levels survived, scores under each limit; derivations in `lib/games.ts` |
| Connect Discord, My Card, Discord gate | **Not verified against Discord** | needs `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`; roles and tiers follow `meitipro/genlayer-cards`; the gate is off until the keys are set |
| X and GitHub verification on the card | **Not verified** | GitHub needs no key; X needs `TWITTERAPI_KEY` |
