#!/usr/bin/env node
// End-to-end run against the live site, through its own public routes, from a
// fresh nickname. Every step is appended to docs/e2e-live.json as it happens.
//
//   node scripts/e2e-live.mjs https://genlayergamehub.vercel.app
//   node scripts/e2e-live.mjs <url> --daily=oracle --reuse   # later, same player, only these dailies
//
// The site allows three daily submissions per hour from one network, so a
// full run can be split: --daily picks the daily games, --reuse continues as
// the last player (its secret is kept in ~/.genlayer-arcade/e2e-players.json,
// outside the repo) and skips the arcade part.
//
// Arcade: the score pipeline (claim, signed session, real waiting time, score
// checks, boards, XP, badges) with posted scores inside each game's limits.
// These are pipeline scores, not played runs, so the run removes them from
// the public boards at the end with the admin remove-score action.
// Daily: one real entry per on-chain game, relayed to Studionet and polled to
// a decided result, then read back from the contract.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv.find((a, i) => i >= 2 && !a.startsWith("--")) || "https://genlayergamehub.vercel.app").replace(/\/$/, "");
const ONLY = (process.argv.find((a) => a.startsWith("--daily="))?.slice(8) || "verdict,bridge,oracle").split(",");
const REUSE = process.argv.includes("--reuse");
const PLAYERS = join(homedir(), ".genlayer-arcade", "e2e-players.json");
const LOG = new URL("../docs/e2e-live.json", import.meta.url);
const ADMIN = JSON.parse(readFileSync(join(homedir(), ".genlayer-arcade", "vercel-secrets.json"), "utf8")).ADMIN_TOKEN;

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
const run = { site: BASE, started: new Date().toISOString(), steps: [] };
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
async function post(path, body, headers = {}) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function get(path) {
  const r = await fetch(BASE + path, { cache: "no-store" });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

let name, secret, r;
run.daily = ONLY;
if (REUSE) {
  ({ name, secret } = JSON.parse(readFileSync(PLAYERS, "utf8")).at(-1));
  run.reused = name;
  console.log(`continuing as ${name}`);
} else {
  name = `e2e_${new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "")}`;
  const c = await post("/api/player/claim", { name });
  step("claim a fresh nickname", c.status === 200 && /^[0-9a-f]{64}$/.test(c.data.secret), { name, status: c.status });
  secret = c.data.secret;
  const saved = existsSync(PLAYERS) ? JSON.parse(readFileSync(PLAYERS, "utf8")) : [];
  writeFileSync(PLAYERS, JSON.stringify([...saved, { name, secret, site: BASE }], null, 2) + "\n");
}
if (!REUSE) {
const again = await post("/api/player/claim", { name: name.toUpperCase() });
step("the same name in another case is taken", again.status === 409, { status: again.status, error: again.data.error });

// ---- arcade anti-cheat ----
r = await post("/api/score", { player: name, playerSecret: secret, score: 10 });
step("score without a session token is refused", r.status === 400, { status: r.status, error: r.data.error });
const t0 = (await post("/api/session/start", { game: "chain-snake" })).data.token;
r = await post("/api/score", { token: t0, player: name, playerSecret: secret, score: 10 });
step("a run shorter than minMs is refused", r.status === 422, { status: r.status, error: r.data.error });

// ---- arcade: every game, in parallel sessions ----
const sessions = {};
for (const g of Object.keys(LIMITS)) sessions[g] = { token: (await post("/api/session/start", { game: g })).data.token, at: Date.now() };
const posted = {};
for (const [g, lim] of Object.entries(LIMITS).sort((a, b) => a[1].minMs - b[1].minMs)) {
  const wait = sessions[g].at + lim.minMs + 2000 - Date.now();
  if (wait > 0) await sleep(wait);
  const seconds = (Date.now() - sessions[g].at) / 1000;
  const score = Math.floor(seconds * lim.maxPerSec * 0.2);
  if (g === "chain-snake") {
    const bad = await post("/api/score", { token: sessions[g].token, player: name, playerSecret: "0".repeat(64), score });
    step("another device's secret cannot post under this name", bad.status === 401, { status: bad.status, error: bad.data.error });
    const tooHigh = (await post("/api/session/start", { game: g })).data.token;
    await sleep(lim.minMs + 1000);
    const hi = await post("/api/score", { token: tooHigh, player: name, playerSecret: secret, score: 100000 });
    step("an impossible score is refused", hi.status === 422, { status: hi.status, error: hi.data.error });
  }
  r = await post("/api/score", { token: sessions[g].token, player: name, playerSecret: secret, score });
  posted[g] = score;
  step(`${g}: score accepted and ranked`, r.status === 200 && r.data.best === score && r.data.rank >= 1, { score, status: r.status, rank: r.data.rank, badges: r.data.badges });
  if (g === "chain-snake") {
    const re = await post("/api/score", { token: sessions[g].token, player: name, playerSecret: secret, score });
    step("a reused session token is refused", re.status === 409, { status: re.status, error: re.data.error });
  }
}
const board = await get(`/api/leaderboard?game=validator-run&scope=season&player=${name}`);
step("the season board shows the player", board.data?.you?.player === name, { you: board.data?.you });
}

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
  const s = await post(`/api/daily/${g}/submit`, { player: name, playerSecret: secret, ...body });
  step(`${g}: submit relayed, hash returned at once`, s.status === 200 && /^0x[0-9a-f]{64}$/i.test(s.data.hash), { round: round.id, status: s.status, hash: s.data.hash, error: s.data.error, body });
  if (s.status !== 200) continue;
  const dup = await post(`/api/daily/${g}/submit`, { player: name, playerSecret: secret, ...body });
  step(`${g}: a second entry in the same round is blocked`, dup.status === 409, { status: dup.status, error: dup.data.error });
  let st = null;
  const begin = Date.now();
  while (Date.now() - begin < 240000) {
    st = (await get(`/api/daily/${g}/status?hash=${s.data.hash}`)).data;
    if (["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED"].includes(st.status) && st.result) break;
    if (["UNDETERMINED", "CANCELED"].includes(st.status)) break;
    await sleep(5000);
  }
  const secs = Math.round((Date.now() - begin) / 1000);
  step(`${g}: decided on chain`, st && ["ACCEPTED", "FINALIZED"].includes(st.status) && st.result === "FINISHED_WITH_RETURN", {
    status: st?.status,
    result: st?.result,
    agree: st?.agree,
    voters: st?.voters,
    seconds: secs,
    explorer: `https://explorer-studio.genlayer.com/tx/${s.data.hash}`,
  });
  await sleep(1500);
  const e = (await get(`/api/daily/${g}/entry?round=${round.id}&player=${name}`)).data;
  step(`${g}: entry read back from the contract`, !!e.entry, { entry: e.entry });
}

// ---- profile ----
const html = await fetch(`${BASE}/p/${name}`).then((x) => x.text());
step("profile renders level, badges and daily history", html.includes(name) && html.includes("Daily history") && html.includes("explorer-studio.genlayer.com/tx/"), {});

// ---- unknown hashes are not polled ----
r = await get(`/api/daily/verdict/status?hash=0x${"ab".repeat(32)}`);
step("status refuses hashes the hub did not send", r.status === 404, { status: r.status });

// ---- clean the public boards ----
let removed = 0;
if (!REUSE) {
for (const g of Object.keys(LIMITS)) {
  const x = await post("/api/admin/remove-score", { game: g, player: name }, { "x-admin-token": ADMIN });
  removed += x.data.removed ?? 0;
}
step("pipeline scores removed from the public boards (admin remove-score)", removed === Object.keys(LIMITS).length * 2, { removed });
}

run.finished = new Date().toISOString();
run.failures = failures;
save();
console.log(`\n${failures} failing step(s); log docs/e2e-live.json`);
process.exit(failures ? 1 : 0);
