// lib/admin.ts: the owner actions behind /admin and the Tier B crons.
// Every write goes through the relayer, which deployed (and so owns) all four
// contracts. Each sent hash is remembered so the admin panel can poll it.
import "server-only";
import { revalidateTag } from "next/cache";
import bridges from "@/data/bridges.json";
import challenges from "@/data/challenges.json";
import oracles from "@/data/oracles.json";
import { addressFor, tagFor } from "./daily";
import { ARCADE } from "./games";
import { contractAddress, readJson, readRaw, relayWrite, txStatus, type TxView } from "./genlayer";
import type { BridgeRound, OnchainGame, OracleRound, VerdictRound } from "./onchain";
import { redis } from "./redis";
import { previousSeasonId } from "./season";
import { award } from "./xp";

export type Sent = { action: string; game?: string; hash: string; detail?: string };

const ADMIN_TX = (hash: string) => `admin:tx:${hash}`;

/** Admin flows send several writes in a row; a pause keeps them under Studionet's per-IP request budget. */
let lastSend = 0;
const PACE_MS = 6000;

async function send(game: string, address: string, fn: string, args: unknown[], detail?: string): Promise<Sent> {
  const wait = lastSend + PACE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const hash = await relayWrite(address, fn, args);
  lastSend = Date.now();
  const rec: Sent = { action: fn, game, hash, detail };
  await redis.set(ADMIN_TX(hash), JSON.stringify({ ...rec, at: new Date().toISOString() }), { ex: 30 * 86400 });
  await redis.lpush("admin:log", JSON.stringify({ ...rec, at: new Date().toISOString() }));
  await redis.ltrim("admin:log", 0, 99);
  return rec;
}

export async function adminLog(): Promise<(Sent & { at: string })[]> {
  return (await redis.lrange("admin:log", 0, 49)).map((s) => (typeof s === "string" ? JSON.parse(s) : s));
}

export async function adminTxStatus(hash: `0x${string}`): Promise<TxView | null> {
  const raw = await redis.get<string>(ADMIN_TX(hash));
  if (!raw) return null;
  const view = await txStatus(hash);
  if (["ACCEPTED", "FINALIZED"].includes(view.status)) {
    const game = (typeof raw === "string" ? JSON.parse(raw) : raw).game as string;
    if (game === "verdict" || game === "bridge" || game === "oracle") revalidateTag(tagFor(game));
    if (game === "ledger") revalidateTag("seasons");
  }
  return view;
}

function need(game: OnchainGame): `0x${string}` {
  const a = addressFor(game);
  if (!a) throw new Error(`${game} contract is not deployed`);
  return a;
}

/** Content pack index for a UTC day: rounds rotate through data/*.json. */
export function dayIndex(d = new Date(), length = 1): number {
  const day = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
  return ((day % length) + length) % length;
}

async function latest<T>(game: OnchainGame): Promise<{ rid: string | null; round: T | null }> {
  const a = need(game);
  const id = await readRaw(a, "get_latest_round_id");
  if (!id || id === "0") return { rid: null, round: null };
  return { rid: id, round: await readJson<T>(a, "get_round", [id]) };
}

// ---- per game ----
export async function openVerdict(input?: { challenge?: string; criteria?: string; index?: number }): Promise<Sent> {
  const pick = challenges[input?.index ?? dayIndex(new Date(), challenges.length)] ?? challenges[0];
  const challenge = (input?.challenge || pick.challenge).trim();
  const criteria = (input?.challenge ? input?.criteria ?? "" : pick.criteria).trim();
  return send("verdict", need("verdict"), "open_round", [challenge, criteria], challenge);
}

export async function openBridge(input?: { start?: string; end?: string; index?: number }): Promise<Sent> {
  const pick = bridges[input?.index ?? dayIndex(new Date(), bridges.length)] ?? bridges[0];
  const start = (input?.start || pick.start).toLowerCase().trim();
  const end = (input?.end || pick.end).toLowerCase().trim();
  return send("bridge", need("bridge"), "open_round", [start, end], `${start} to ${end}`);
}

export async function openOracle(input?: { question?: string; url?: string; path?: string; unit?: string; index?: number }): Promise<Sent> {
  const pick = oracles[input?.index ?? dayIndex(new Date(), oracles.length)] ?? oracles[0];
  const q = input?.url ? { question: input.question ?? "", url: input.url, path: input.path ?? "", unit: input.unit ?? "" } : pick;
  return send("oracle", need("oracle"), "open_round", [q.question, q.url, q.path, q.unit], q.question);
}

export async function closeRound(game: "verdict" | "bridge", rid: string): Promise<Sent> {
  return send(game, need(game), "close_round", [rid], `round ${rid}`);
}

export async function lockOracle(rid: string): Promise<Sent> {
  return send("oracle", need("oracle"), "lock_round", [rid], `round ${rid}`);
}

export async function resolveOracle(rid: string): Promise<Sent> {
  return send("oracle", need("oracle"), "resolve", [rid], `round ${rid}`);
}

/** Wait (bounded) for a write to be decided, so a dependent write can follow. */
export async function waitDecided(hash: `0x${string}`, ms = 90000): Promise<TxView | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const v = await txStatus(hash);
      if (["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED"].includes(v.status)) return v;
    } catch {
      /* keep waiting */
    }
    await new Promise((r) => setTimeout(r, 6000));
  }
  return null;
}

// ---- schedules (00:00 UTC and 18:00 UTC, section 1) ----

/**
 * 00:00 UTC: close yesterday's Verdict and Bridge and open new ones. Oracle:
 * a round still open keeps running to its 18:00 deadline (it may have been
 * opened by hand late in the day); a round stuck in "locked" (a failed
 * resolve) is resolved first; otherwise today's round opens.
 */
export async function dailyRollover(): Promise<Sent[]> {
  const out: Sent[] = [];
  for (const game of ["verdict", "bridge"] as const) {
    const { rid, round } = await latest<VerdictRound | BridgeRound>(game);
    if (rid && round?.open) out.push(await closeRound(game, rid));
    out.push(game === "verdict" ? await openVerdict() : await openBridge());
  }
  const { rid, round } = await latest<OracleRound>("oracle");
  if (rid && round?.state === "locked") out.push(await resolveOracle(rid));
  if (!rid || round?.state !== "open") out.push(await openOracle());
  for (const g of ["verdict", "bridge", "oracle"] as const) revalidateTag(tagFor(g));
  return out;
}

/** 18:00 UTC: lock the Oracle round, then resolve it from the live source. */
export async function oracleDeadline(): Promise<Sent[]> {
  const out: Sent[] = [];
  const { rid, round } = await latest<OracleRound>("oracle");
  if (!rid || !round || round.state === "resolved") return out;
  if (round.state === "open") {
    const lock = await lockOracle(rid);
    out.push(lock);
    const v = await waitDecided(lock.hash as `0x${string}`);
    if (!v || !["ACCEPTED", "FINALIZED"].includes(v.status)) return out;
  }
  out.push(await resolveOracle(rid));
  revalidateTag(tagFor("oracle"));
  return out;
}

// ---- seasons ----

/** Monday: for each arcade game, write last week's top 10 to SeasonLedger and award Season Champion. */
export async function finalizeSeason(season = previousSeasonId(), force = false): Promise<{ sent: Sent[]; skipped: string[] }> {
  const ledger = contractAddress("LEDGER_CONTRACT");
  if (!ledger) throw new Error("SeasonLedger is not deployed");
  const recorded = new Set<string>(JSON.parse((await readRaw(ledger, "list_seasons")) || "[]"));
  const sent: Sent[] = [];
  const skipped: string[] = [];
  for (const g of ARCADE) {
    const key = `${g.slug}:${season}`;
    if (recorded.has(key) || (!force && (await redis.sismember("seasons:finalized", key)))) {
      skipped.push(`${key} already recorded`);
      continue;
    }
    const top = await redis.ztop(`lb:${g.slug}:${season}`, 10);
    if (!top.length) {
      skipped.push(`${key} has no scores`);
      continue;
    }
    const payload = JSON.stringify(top.map((r, i) => ({ rank: i + 1, player: r.member, score: r.score })));
    sent.push(await send("ledger", ledger, "record_season", [key, payload], key));
    await redis.sadd("seasons:finalized", key);
    await award(top[0].member, "season-champion");
  }
  revalidateTag("seasons");
  return { sent, skipped };
}

export async function removeScore(game: string, player: string, season?: string): Promise<number> {
  let n = 0;
  if (season) n += await redis.zrem(`lb:${game}:${season}`, player);
  else {
    const { seasonId } = await import("./season");
    n += await redis.zrem(`lb:${game}:${seasonId()}`, player);
  }
  n += await redis.zrem(`lb:${game}:all`, player);
  return n;
}

export function adminOk(req: Request): boolean {
  const want = process.env.ADMIN_TOKEN;
  const got = req.headers.get("x-admin-token");
  if (!want || !got || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

export function cronOk(req: Request): boolean {
  const s = process.env.CRON_SECRET;
  return !!s && req.headers.get("authorization") === `Bearer ${s}`;
}
