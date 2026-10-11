#!/usr/bin/env node
// End-to-end run of the arcade pipeline and the daily games through the site's
// own public routes:
//
//   node scripts/e2e-live.mjs http://localhost:3017 [--daily=verdict,bridge,oracle]
//
// The site is Discord-only and a real Discord login cannot be scripted, so this
// signs in through /api/dev/login, which exists only on a local development
// server with no Discord keys (404 in production). Everything after the login
// is the real path: signed sessions, score checks, the relayer, the contracts
// on Studionet, the status polling. Steps go to docs/e2e-live.json.
//
// Arcade: the score pipeline with posted scores inside each game's limits.
// These are pipeline scores, not played runs, so they are removed from the
// boards at the end. Daily: one real entry per on-chain game, relayed to
// Studionet and polled to a decided result, then read back from the contract.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv.find((a, i) => i >= 2 && !a.startsWith("--")) || "http://localhost:3017").replace(/\/$/, "");
const ONLY = (process.argv.find((a) => a.startsWith("--daily="))?.slice(8) || "verdict,bridge,oracle").split(",");
const LOG = new URL("../docs/e2e-live.json", import.meta.url);
// the admin token of the deployment being tested: .env.local for a local server, the
// generated production secrets otherwise
const ADMIN = /localhost|127\.0\.0\.1/.test(BASE)
  ? (readFileSync(new URL("../.env.local", import.meta.url), "utf8").match(/^ADMIN_TOKEN=(.+)$/m)?.[1] ?? "").trim()
  : JSON.parse(readFileSync(join(homedir(), ".genlayer-arcade", "vercel-secrets.json"), "utf8")).ADMIN_TOKEN;

const LIMITS = {
  "validator-run": { maxPerSec: 180, minMs: 5000 },
  "consensus-stack": { maxPerSec: 105, minMs: 3000 },
  "leader-rotation": { maxPerSec: 180, minMs: 55000 },
  equivalence: { maxPerSec: 117, minMs: 15000 },
  "chain-snake": { maxPerSec: 45, minMs: 5000 },
  "appeal-breaker": { maxPerSec: 135, minMs: 8000 },
  "sky-hop": { maxPerSec: 60, minMs: 1000 },
  "fee-flap": { maxPerSec: 15, minMs: 1000 },
  "whack-a-node": { maxPerSec: 40, minMs: 40000 },
  "node-defender": { maxPerSec: 55, minMs: 1500 },
  "stake-merge": { maxPerSec: 190, minMs: 3000 },
};

const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : { runs: [] };
const run = { site: BASE, started: new Date().toISOString(), daily: ONLY, steps: [] };
log.runs.push(run);
const save = () => writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
let failures = 0;
function step(name, pass, detail = {}) {
  run.steps.push({ step: name, pass, at: new Date().toISOString(), ...detail });
  save();
  if (!pass) failures++;
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name} ${JSON.stringify(detail).slice(0, 220)}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let COOKIE = "";
async function devLogin(name) {
  const r = await fetch(`${BASE}/api/dev/login?name=${encodeURIComponent(name)}`, { redirect: "manual" });
  COOKIE = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return r.status >= 300 && r.status < 400 && COOKIE.includes("arcade_session");
}
async function post(path, body, headers = {}) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...(COOKIE ? { cookie: COOKIE } : {}), ...headers }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function get(path) {
  const r = await fetch(BASE + path, { cache: "no-store", headers: COOKIE ? { cookie: COOKIE } : {} });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

const name = `e2e_${new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "")}`;
const signedIn = await devLogin(name);
step("sign in (local development login)", signedIn, { name });
if (!signedIn) {
  console.log("This script needs a local development server without Discord keys.");
  process.exit(2);
}
const me = await get("/api/me");
step("/api/me names the signed-in player", me.data.name === name, { me: me.data });

// ---- the gate ----
const saved = COOKIE;
COOKIE = "";
let r = await post("/api/session/start", { game: "chain-snake" });
step("a signed-out request is refused", r.status === 401 && r.data.gate === "discord", { status: r.status });
r = await post("/api/score", { token: "x", score: 10 });
step("a signed-out score post is refused", r.status === 401 || r.status === 400, { status: r.status });
COOKIE = saved;

// ---- arcade anti-cheat ----
r = await post("/api/score", { score: 10 });
step("score without a session token is refused", r.status === 400, { status: r.status, error: r.data.error });
const t0 = (await post("/api/session/start", { game: "chain-snake" })).data.token;
r = await post("/api/score", { token: t0, score: 10 });
step("a run shorter than minMs is refused", r.status === 422, { status: r.status, error: r.data.error });

// ---- arcade: every game, in parallel sessions ----
const sessions = {};
for (const g of Object.keys(LIMITS)) sessions[g] = { token: (await post("/api/session/start", { game: g })).data.token, at: Date.now() };
for (const [g, lim] of Object.entries(LIMITS).sort((a, b) => a[1].minMs - b[1].minMs)) {
  const wait = sessions[g].at + lim.minMs + 2000 - Date.now();
  if (wait > 0) await sleep(wait);
  const seconds = (Date.now() - sessions[g].at) / 1000;
  const score = Math.floor(seconds * lim.maxPerSec * 0.2);
  if (g === "chain-snake") {
    const tooHigh = (await post("/api/session/start", { game: g })).data.token;
    await sleep(lim.minMs + 1000);
    const hi = await post("/api/score", { token: tooHigh, score: 100000 });
    step("an impossible score is refused", hi.status === 422, { status: hi.status, error: hi.data.error });
  }
  r = await post("/api/score", { token: sessions[g].token, score });
  step(`${g}: score accepted and ranked`, r.status === 200 && r.data.best === score && r.data.rank >= 1, { score, status: r.status, rank: r.data.rank, badges: r.data.badges });
  if (g === "chain-snake") {
    const re = await post("/api/score", { token: sessions[g].token, score });
    step("a reused session token is refused", re.status === 409, { status: re.status, error: re.data.error });
  }
}
const board = await get(`/api/leaderboard?game=validator-run&scope=season&player=${name}`);
step("the season board shows the player", board.data?.you?.player === name, { you: board.data?.you });

// ---- daily on-chain ----
const temp = await fetch("https://api.open-meteo.com/v1/forecast?latitude=35.69&longitude=51.39&current=temperature_2m").then((x) => x.json()).catch(() => null);
const DAILY = [
  ["verdict", { entry: "Dispute desk: freelancers and clients upload brief and delivery, AI validators agree on who gets paid." }],
  ["bridge", { chain: null }],
  ["oracle", { value: String(Math.round(temp?.current?.temperature_2m ?? 15) + 1) }],
];
for (const [g, body] of DAILY.filter(([g]) => ONLY.includes(g))) {
  const round = (await get(`/api/daily/${g}/round`)).data.round;
  if (!round) {
    step(`${g}: an open round exists`, false, {});
    continue;
  }
  if (g === "bridge") body.chain = `${round.start} sky ${round.end}`;
  const s = await post(`/api/daily/${g}/submit`, body);
  step(`${g}: submit relayed, hash returned at once`, s.status === 200 && /^0x[0-9a-f]{64}$/i.test(s.data.hash), { round: round.id, status: s.status, hash: s.data.hash, error: s.data.error, body });
  if (s.status !== 200) continue;
  const dup = await post(`/api/daily/${g}/submit`, body);
  step(`${g}: a second entry in the same round is blocked`, dup.status === 409, { status: dup.status, error: dup.data.error });
  let st = null;
  const begin = Date.now();
  while (Date.now() - begin < 240000) {
    st = (await get(`/api/daily/${g}/status?hash=${s.data.hash}`)).data;
    if (["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED"].includes(st.status) && st.result) break;
    if (["UNDETERMINED", "CANCELED"].includes(st.status)) break;
    await sleep(5000);
  }
  step(`${g}: decided on chain`, st && ["ACCEPTED", "FINALIZED"].includes(st.status) && st.result === "FINISHED_WITH_RETURN", {
    status: st?.status,
    result: st?.result,
    agree: st?.agree,
    voters: st?.voters,
    seconds: Math.round((Date.now() - begin) / 1000),
    explorer: `https://explorer-studio.genlayer.com/tx/${s.data.hash}`,
  });
  await sleep(1500);
  const e = (await get(`/api/daily/${g}/entry?round=${round.id}&player=${name}`)).data;
  step(`${g}: entry read back from the contract`, !!e.entry, { entry: e.entry });
}

// ---- the card and the profile ----
const card = await get(`/api/card/${name}`);
step("the card has a tier, a number and a real hash", !!card.data.tier && /^0x[0-9a-f]{40}$/.test(card.data.recordHash ?? ""), { tier: card.data.tier, no: card.data.credentialNo });
r = await get(`/api/daily/verdict/status?hash=0x${"ab".repeat(32)}`);
step("status refuses hashes the hub did not send", r.status === 404, { status: r.status });

// ---- clean the boards ----
let removed = 0;
for (const g of Object.keys(LIMITS)) {
  const x = await post("/api/admin/remove-score", { game: g, player: name }, { "x-admin-token": ADMIN });
  removed += x.data.removed ?? 0;
}
step("pipeline scores removed from the boards (admin remove-score)", removed === Object.keys(LIMITS).length * 2, { removed });

run.finished = new Date().toISOString();
run.failures = failures;
save();
console.log(`\n${failures} failing step(s); log docs/e2e-live.json`);
process.exit(failures ? 1 : 0);
