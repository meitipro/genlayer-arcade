# API and environment settings

Everything the site needs from outside, in one place. Values are never kept in
the repository: Vercel holds them, and the local copy lives in
`~/.genlayer-arcade/` on the build machine.

## 1. What is already set on Vercel (production)

Names only. Project `genlayergamehub`, team `mahdighs-projects`.

| Variable | What it is | Where the value came from |
|---|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL` | Upstash Redis (shared store; this app prefixes every key `arcade:`) | Vercel Marketplace integration `upstash-kv-indigo-compass` |
| `SESSION_SECRET`, `PLAYER_PEPPER`, `ADMIN_TOKEN`, `CRON_SECRET` | random 32 bytes each | `scripts/vercel_env.py`; kept locally in `~/.genlayer-arcade/vercel-secrets.json` |
| `RELAYER_PRIVATE_KEY` | the account that deployed and owns the five contracts and pays players' fees | `~/.genlayer-arcade/accounts.json` (`relayer`), a test account |
| `GENLAYER_NETWORK` | `studionet` | `lib/deployment.json` |
| `VERDICT_CONTRACT`, `BRIDGE_CONTRACT`, `ORACLE_CONTRACT`, `LEDGER_CONTRACT`, `REVIEW_CONTRACT` | contract addresses | `contracts/FROZEN.json` |
| `NEXT_PUBLIC_EXPLORER`, `NEXT_PUBLIC_SITE_URL` | explorer and site URLs | `lib/deployment.json` |

## 2. What is still needed, and where to get it

### 2.1 Discord (Connect Discord, My Card, and the play gate)

1. Open https://discord.com/developers/applications and press **New Application**. Name it, for example, `GenLayer Arcade`.
2. Left menu, **OAuth2**:
   - **Redirects**, add exactly: `https://genlayergamehub.vercel.app/api/discord/callback`
   - For running the site on your own machine also add: `http://localhost:3000/api/discord/callback`
   - Copy the **Client ID**.
   - Press **Reset Secret** and copy the **Client Secret** (it is shown once).
3. Nothing else is needed:
   - **No bot.** Do not add a bot, and no bot token is used.
   - **No privileged intents.**
   - **No scopes to tick in the portal.** The site asks for `identify` and `guilds.members.read` itself in the authorize link. `guilds.members.read` reads the user's own member record in one server (the GenLayer server, id `1237055789441487021`); the app does not have to be added to that server.
4. Put the two values on Vercel:

   ```bash
   vercel env add DISCORD_CLIENT_ID production
   vercel env add DISCORD_CLIENT_SECRET production --sensitive
   vercel deploy --prod
   ```

   or write them to `~/.genlayer-arcade/keys.json` (see 3 below) and run `python scripts/vercel_env.py`.

Optional Discord variables:

| Variable | Default | Use |
|---|---|---|
| `DISCORD_GUILD_ID` | `1237055789441487021` (GenLayer, from discord.gg/genlayerlabs) | read roles from another server |
| `DISCORD_REDIRECT_URI` | `<site origin>/api/discord/callback` | set only if the site is served from a different domain than the one in the Discord portal |
| `ARCADE_REQUIRE_DISCORD` | gate **on** once the two keys are set | set to `0` to turn the gate off and keep Connect Discord optional |

Until `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set the gate is off and nobody is locked out.

### 2.2 X (Twitter) handle verification

`TWITTERAPI_KEY`: an API key from https://twitterapi.io (the user-info endpoint, `GET /twitter/user/info`). Without it the X box on My Card says "not configured". GitHub needs no key.

```bash
vercel env add TWITTERAPI_KEY production --sensitive
```

### 2.3 Bradbury (only if the network is switched later)

Not configured. It needs a relayer funded from https://testnet-faucet.genlayer.foundation (100 GEN, once a week, and the page says it requires 0.01 ETH on mainnet) and a genlayer-js release that sends fees; see the README.

## 3. Handing keys over without pasting them anywhere

`python scripts/vercel_env.py` also reads `~/.genlayer-arcade/keys.json`, if it exists, and sets any of these names on Vercel without printing the values:

```json
{
  "DISCORD_CLIENT_ID": "",
  "DISCORD_CLIENT_SECRET": "",
  "TWITTERAPI_KEY": ""
}
```

The file is outside the repository, and the script ignores every name that is not in the list above.

## 4. HTTP routes

All under `https://genlayergamehub.vercel.app/api`. "Secret" means the nickname's device secret in the request body.

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/player/claim` | POST | none, 5/hour/IP | claim a nickname, returns the device secret once |
| `/session/start` | POST | nickname secret (when the Discord gate is on), 30/min/IP | signed one-use play session; optional `room` code for tournaments |
| `/score` | POST | session token + secret, 30/min/IP | post a score; checked against each game's cap, minimum time and rate |
| `/leaderboard?game&scope&season&player` | GET | none | arcade season and all-time boards |
| `/daily/[game]/round` | GET | none | round from the contract (`verdict`, `bridge`, `oracle`) |
| `/daily/[game]/submit` | POST | nickname secret, 3/hour/IP | relayed on-chain entry; returns the transaction hash at once |
| `/daily/[game]/register` | POST | the wallet's own transaction, read back from the chain | wallet mode: record a transaction the player sent |
| `/daily/[game]/status?hash` | GET | only hashes this hub recorded | status and execution result |
| `/daily/[game]/entry?round&player` | GET | none | the contract's entry view |
| `/daily/[game]/board?round` | GET | none | the round board |
| `/community/submit` | POST | nickname secret, 3/day/IP | send a game link to the GameReview contract |
| `/community/status?hash` | GET | only hashes this hub sent | review transaction status |
| `/community/list` | GET | none | every on-chain review, newest first |
| `/events[?code]` | GET | none | tournament events, or the event a room code belongs to |
| `/discord/start` | POST | nickname secret | returns the Discord authorize URL |
| `/discord/callback` | GET | Discord redirect (one-use state) | reads roles, links the account, redirects to `/card` |
| `/discord/disconnect` | POST | nickname secret | unlink Discord |
| `/social/start`, `/social/verify`, `/social/remove` | POST | nickname secret | X and GitHub bio-code verification |
| `/card/[name]` | GET | none | the public card data (no secrets) |
| `/rpc` | POST | 120/min/IP | same-origin relay of read-only and fee JSON-RPC methods to Studionet; refuses everything that signs or spends |
| `/faucet` | POST | 1 per address per 10 min, 5/hour/IP | Studionet test GEN for wallet mode |
| `/admin/[action]` | POST | header `x-admin-token` | open, close, lock, resolve, finalize-season, remove-score, create-event, delete-event, review-recheck, review-delist, rollover, deadline, tx, log |
| `/cron/daily`, `/cron/oracle`, `/cron/season` | GET | `Authorization: Bearer CRON_SECRET` | run by Vercel Cron at 00:00, 18:00 UTC and Monday 00:05 UTC |
| `/og/...` | GET | none | 1200x630 share images |

## 5. Rate limits you may run into

- Studionet allows about 30 JSON-RPC requests a minute per IP; the relayer paces its writes 6 seconds apart and retries only while the nonce proves nothing was sent.
- twitterapi.io charges per lookup; the site only looks a handle up when someone presses Verify.
