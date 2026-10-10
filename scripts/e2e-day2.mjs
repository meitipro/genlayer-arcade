#!/usr/bin/env node
// Day-two features against the live site, through its public routes:
//   community review (submit a real page, on-chain verdict, listing, delist),
//   tournament rooms (create, join with the room code, event board, refusals).
//
//   node scripts/e2e-day2.mjs https://genlayergamehub.vercel.app
//
// Everything it creates is removed at the end (the review is delisted with a
// reason, the event deleted, the scores removed). Steps go to docs/day2-live.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv[2] || "https://genlayergamehub.vercel.app").replace(/\/$/, "");
const LOG = new URL("../docs/day2-live.json", import.meta.url);
const ADMIN = JSON.parse(readFileSync(join(homedir(), ".genlayer-arcade", "vercel-secrets.json"), "utf8")).ADMIN_TOKEN;
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : { runs: [] };
const run = { site: BASE, started: new Date().toISOString(), steps: [] };
log.runs.push(run);
const save = () => writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
let failures = 0;
const step = (name, pass, detail = {}) => {
  run.steps.push({ step: name, pass, at: new Date().toISOString(), ...detail });
  save();
  if (!pass) failures++;
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name} ${JSON.stringify(detail).slice(0, 260)}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(path, body, headers = {}) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const get = async (path) => {
  const r = await fetch(BASE + path, { cache: "no-store" });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const admin = (action, body = {}) => post(`/api/admin/${action}`, body, { "x-admin-token": ADMIN });

const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "");
const name = `d2_${stamp}`;
const c = await post("/api/player/claim", { name });
step("claim a fresh nickname", c.status === 200, { name });
const secret = c.data.secret;

// ---- community review ----
const gameUrl = `${BASE}/play/chain-snake`;
const bad = await post("/api/community/submit", { player: name, playerSecret: secret, title: "x", url: "http://example.com/g" });
step("a bad title and an http link are refused before any fee", bad.status === 400, { error: bad.data.error });
const anon = await post("/api/community/submit", { player: name, playerSecret: "0".repeat(64), title: "Chain Snake", url: gameUrl });
step("another device's secret cannot submit", anon.status === 401, { status: anon.status });

const sub = await post("/api/community/submit", { player: name, playerSecret: secret, title: "Chain Snake (this hub)", url: gameUrl });
step("a real game page is sent to the GameReview contract, hash at once", sub.status === 200 && /^0x[0-9a-f]{64}$/i.test(sub.data.hash ?? ""), { status: sub.status, hash: sub.data.hash, error: sub.data.error });
if (sub.status === 200) {
  const dup = await post("/api/community/submit", { player: name, playerSecret: secret, title: "Again", url: gameUrl });
  step("the same link again is refused", dup.status === 409, { status: dup.status, error: dup.data.error });
  let st = null;
  const begin = Date.now();
  while (Date.now() - begin < 240000) {
    st = (await get(`/api/community/status?hash=${sub.data.hash}`)).data;
    if (["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED"].includes(st.status) && st.result) break;
    await sleep(5000);
  }
  step("the validators decided on chain", ["ACCEPTED", "FINALIZED"].includes(st?.status) && st?.result === "FINISHED_WITH_RETURN", {
    status: st?.status,
    result: st?.result,
    agree: st?.agree,
    voters: st?.voters,
    seconds: Math.round((Date.now() - begin) / 1000),
    explorer: `https://explorer-studio.genlayer.com/tx/${sub.data.hash}`,
  });
  await sleep(2000);
  let review = null;
  for (let i = 0; i < 6 && !review; i++) {
    const l = (await get("/api/community/list")).data;
    review = (l.reviews ?? []).find((r) => r.url === gameUrl) ?? null;
    if (!review) await sleep(5000);
  }
  step("the verdict is in the list: PLAYABLE and listed", review?.label === "PLAYABLE" && review?.listed === true, { review });
  if (review) {
    const d = await admin("review-delist", { id: review.id, reason: "end-to-end test of the live site, not a real submission" });
    step("admin delists it with a reason", d.status === 200, { status: d.status, body: d.data });
    if (d.status === 200) {
      let after = null;
      for (let i = 0; i < 12; i++) {
        await sleep(6000);
        const l = (await get("/api/community/list")).data;
        after = (l.reviews ?? []).find((r) => r.id === review.id);
        if (after && after.listed === false) break;
      }
      step("the delisting is on the contract, with the reason", after?.listed === false && /end-to-end/.test(after?.delisted ?? ""), { review: after });
    }
  }
}

// ---- tournament rooms ----
const code = `T-${stamp}`;
const now = Date.now();
const made = await admin("create-event", {
  title: `Live test ${stamp}`,
  game: "chain-snake",
  roomCode: code,
  startsAt: new Date(now - 60000).toISOString(),
  endsAt: new Date(now + 20 * 60000).toISOString(),
  rules: "end-to-end test",
});
step("admin creates a live event with a room code", made.status === 200, { status: made.status, event: made.data.event?.id, error: made.data.error });
const eventId = made.data.event?.id;
const dupCode = await admin("create-event", { title: "Other", game: "chain-snake", roomCode: code, startsAt: new Date(now).toISOString(), endsAt: new Date(now + 3600000).toISOString() });
step("a room code cannot be used twice", dupCode.status === 400, { error: dupCode.data.error });
const found = await get(`/api/events?code=${code.toLowerCase()}`);
step("the room code finds the event, and it is live", found.data.event?.state === "live", { state: found.data.event?.state });
const unknown = await post("/api/session/start", { game: "chain-snake", room: "NOPE-0" });
step("an unknown room code is refused", unknown.status === 404, { status: unknown.status });
const wrong = await post("/api/session/start", { game: "validator-run", room: code });
step("a room for another game is refused", wrong.status === 400, { status: wrong.status, error: wrong.data.error });

const s = await post("/api/session/start", { game: "chain-snake", room: code });
step("a session starts in the room", s.status === 200 && !!s.data.room, { status: s.status, room: s.data.room });
await sleep(7000);
const sc = await post("/api/score", { token: s.data.token, player: name, playerSecret: secret, score: 60 });
step("the score lands on the season board and the event board", sc.status === 200 && sc.data.event?.rank === 1, { status: sc.status, body: sc.data });
const page = await fetch(`${BASE}/events/${eventId}`).then((x) => x.text());
step("the event page shows the player on the event board", page.includes(name), {});

// ---- the gate is off while Discord is not configured ----
const dc = await post("/api/discord/start", { player: name, playerSecret: secret });
step("Connect Discord says it is not configured (no keys yet)", dc.status === 503, { status: dc.status, error: dc.data.error });

// ---- clean up ----
const del = await admin("delete-event", { id: eventId });
step("the event is deleted", del.status === 200, { status: del.status });
let removed = 0;
for (const g of ["chain-snake"]) removed += (await admin("remove-score", { game: g, player: name })).data.removed ?? 0;
step("the test score is removed from the public boards", removed === 2, { removed });

run.finished = new Date().toISOString();
run.failures = failures;
save();
console.log(`\n${failures} failing step(s); log docs/day2-live.json`);
process.exit(failures ? 1 : 0);
