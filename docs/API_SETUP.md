# API and environment settings

Everything the site needs from outside, in one place. Values are never kept in
the repository: Vercel holds them, and the local copy lives in
`~/.genlayer-arcade/` on the build machine.

## 1. Set on Vercel (production)

Names only. Project `genlayergamehub`, team `mahdighs-projects`.

| Variable | What it is | Where the value came from |
|---|---|---|
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | the Discord application behind the one login | Discord Developer Portal, via `~/.genlayer-arcade/keys.json` and `scripts/vercel_env.py` |
| `TWITTERAPI_KEY` | optional X account on the card | twitterapi.io, same route |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL` | Upstash Redis (shared store; this app prefixes every key `arcade:`) | Vercel Marketplace integration `upstash-kv-indigo-compass` |
| `SESSION_SECRET`, `ADMIN_TOKEN`, `CRON_SECRET` | random 32 bytes each: signs the login cookie and game sessions, guards `/api/admin`, guards the crons | `scripts/vercel_env.py`; kept locally in `~/.genlayer-arcade/vercel-secrets.json` |
| `RELAYER_PRIVATE_KEY` | the account that deployed and owns the five contracts and pays players' fees | `~/.genlayer-arcade/accounts.json` (`relayer`), a test account |
| `GENLAYER_NETWORK` | `studionet` | `lib/deployment.json` |
| `VERDICT_CONTRACT`, `BRIDGE_CONTRACT`, `ORACLE_CONTRACT`, `LEDGER_CONTRACT`, `REVIEW_CONTRACT` | contract addresses | `contracts/FROZEN.json` |
| `NEXT_PUBLIC_EXPLORER`, `NEXT_PUBLIC_SITE_URL` | explorer and site URLs; the site URL is also what the Discord redirect is built from | `lib/deployment.json` |

## 2. The Discord application

Developer Portal: https://discord.com/developers/applications

| Setting | Value |
|---|---|
| OAuth2 → Redirects | `https://genlayergamehub.vercel.app/api/discord/callback` (and `http://localhost:3000/api/discord/callback` for a local run with keys) |
| Scopes the site asks for | `identify`, `guilds.members.read` (requested by the site in the authorize link; nothing to tick in the portal) |
| Bot | none |
| Bot permissions | none |
| Privileged gateway intents | none |

`guilds.members.read` reads the signed-in user's own member record in one server (the GenLayer server, id `1237055789441487021`, from discord.gg/genlayerlabs); the application does not have to be added to that server.

Optional variables:

| Variable | Default | Use |
|---|---|---|
| `DISCORD_GUILD_ID` | `1237055789441487021` | read roles from another server |
| `DISCORD_REDIRECT_URI` | `<NEXT_PUBLIC_SITE_URL>/api/discord/callback` | set only if the redirect registered in the portal differs |

## 3. How login works, and what is reachable without it

- **Discord is the only login.** There is no nickname signup and no password. The player's name is made once from the Discord username (letters, digits and underscores; a number is added if it is taken). One Discord account is one player.
- **Middleware (`middleware.ts`) keeps every signed-out visitor on `/login`.** Pages redirect there with `?next=`; API routes answer `401 {gate: "discord"}`. The only things reachable without a session: `/login`, `/api/discord/login`, `/api/discord/callback`, assets (`/_next`, `/brand`, `/icon.svg`), `/api/og/*` (share images), `/api/cron/*` (bearer secret) and `/api/admin/*` (admin token). Link-preview crawlers (Discordbot, Twitterbot, and similar) may fetch `/s/*` share pages for their tags.
- **The session** is an HttpOnly, SameSite=Lax cookie (`arcade_session`) signed with `SESSION_SECRET`, valid for 30 days. A route trusts the player named in the cookie, never a name in the request body, and checks that the Discord id on the player record still matches.
- **X is optional**, linked later on My Card with a code in the bio or location. GitHub is not part of the site.
- **Local development** with no Discord keys: `/api/dev/login?name=...` signs in a fake player. It answers 404 in production and whenever Discord keys are present.

## 4. Handing keys over without pasting them anywhere

`python scripts/vercel_env.py` reads `~/.genlayer-arcade/keys.json`, if it exists, and sets these names on Vercel without printing the values; anything else in the file is ignored:

```json
{
  "DISCORD_CLIENT_ID": "",
  "DISCORD_CLIENT_SECRET": "",
  "TWITTERAPI_KEY": ""
}
```

Or directly: `vercel env add DISCORD_CLIENT_SECRET production --sensitive`, then `vercel deploy --prod`.

## 5. HTTP routes

All under `https://genlayergamehub.vercel.app/api`. "Session" means the signed-in cookie above; every route marked so answers 401 without it.

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/discord/login[?next=/path]` | GET | none | redirect to Discord, with a state cookie |
| `/discord/callback` | GET | state cookie from the login redirect | read id and roles, create or find the player, set the session, redirect |
| `/auth/logout` | POST | none | clear the session cookie |
| `/me` | GET | session | the signed-in player |
| `/session/start` | POST | session, 30/min/IP | signed one-use play session; optional `room` code for tournaments |
| `/score` | POST | session + play session token, 30/min/IP | post a score; checked against each game's cap, minimum time and rate |
| `/leaderboard?game&scope&season&player` | GET | session | arcade season and all-time boards |
| `/daily/[game]/round` | GET | session | round from the contract (`verdict`, `bridge`, `oracle`) |
| `/daily/[game]/submit` | POST | session, 3/hour/IP | relayed on-chain entry; returns the transaction hash at once |
| `/daily/[game]/register` | POST | session + the wallet's own transaction, read back from the chain | wallet mode: record a transaction the player sent |
| `/daily/[game]/status?hash` | GET | session; only hashes this hub recorded | status and execution result |
| `/daily/[game]/entry?round&player` | GET | session | the contract's entry view |
| `/daily/[game]/board?round` | GET | session | the round board |
| `/community/submit` | POST | session, 3/day/IP | send a game link to the GameReview contract |
| `/community/status?hash` | GET | session; only hashes this hub sent | review transaction status |
| `/community/list` | GET | session | every on-chain review, newest first |
| `/events[?code]` | GET | session | tournament events, or the event a room code belongs to |
| `/social/start`, `/social/verify`, `/social/remove` | POST | session | optional X handle, proven by a bio code |
| `/card/[name]` | GET | session | the public card data (no secrets) |
| `/rpc` | POST | session, 120/min/IP | same-origin relay of read-only and fee JSON-RPC methods to Studionet; refuses everything that signs or spends |
| `/faucet` | POST | session; 1 per address per 10 min, 5/hour/IP | Studionet test GEN for wallet mode |
| `/admin/[action]` | POST | header `x-admin-token` | open, close, lock, resolve, finalize-season, remove-score, create-event, delete-event, review-recheck, review-delist, rollover, deadline, tx, log |
| `/cron/daily`, `/cron/oracle`, `/cron/season` | GET | `Authorization: Bearer CRON_SECRET` | run by Vercel Cron at 00:00, 18:00 UTC and Monday 00:05 UTC |
| `/og/...` | GET | none | 1200x630 share images |
| `/dev/login` | GET | none; 404 in production and with Discord keys | local development sign-in |

## 6. Rate limits you may run into

- Studionet allows about 30 JSON-RPC requests a minute per IP; the relayer paces its writes 6 seconds apart and retries only while the nonce proves nothing was sent.
- twitterapi.io charges per lookup; the site only looks a handle up when someone presses Verify.
