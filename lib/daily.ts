// lib/daily.ts: server-side reads and bookkeeping for the three daily games.
//
// Studionet allows about 30 RPC requests a minute per IP, so every chain read
// here is cached with unstable_cache and a tag per game, and the tag is
// dropped when one of that game's writes is decided.
import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { contractAddress, readJson, readRaw, txStatus, type TxView } from "./genlayer";
import {
  ONCHAIN,
  type AnyRound,
  type BridgeEntry,
  type OnchainGame,
  type OracleResult,
  type OracleRound,
  type VerdictEntry,
} from "./onchain";
import { redis } from "./redis";
import { addXp, award, dailyXp } from "./xp";

export const tagFor = (game: OnchainGame) => `daily:${game}`;
const TTL = { latest: 30, round: 30, board: 15, entry: 20 };

export function addressFor(game: OnchainGame): `0x${string}` | null {
  return contractAddress(ONCHAIN[game].env);
}

async function latestIdUncached(game: OnchainGame): Promise<string | null> {
  const a = addressFor(game);
  if (!a) return null;
  const id = await readRaw(a, "get_latest_round_id");
  return id && id !== "0" ? id : null;
}

async function roundUncached(game: OnchainGame, rid: string): Promise<AnyRound | null> {
  const a = addressFor(game);
  if (!a) return null;
  const r = await readJson<AnyRound>(a, "get_round", [rid]);
  return r && "id" in r ? r : null;
}

async function boardUncached(game: OnchainGame, rid: string): Promise<unknown[]> {
  const a = addressFor(game);
  if (!a) return [];
  return (await readJson<unknown[]>(a, ONCHAIN[game].boardFn, [rid])) ?? [];
}

async function entryUncached(game: OnchainGame, rid: string, player: string): Promise<unknown | null> {
  const a = addressFor(game);
  if (!a) return null;
  const raw = await readRaw(a, ONCHAIN[game].entryFn, [rid, player]);
  if (!raw) return null;
  const v = JSON.parse(raw);
  return game === "oracle" ? { player, guess: Number(v) } : v;
}

/** Cached, except that "no round yet" is never cached: the first round must show up as soon as it lands. */
export async function latestRoundId(game: OnchainGame) {
  const cached = await unstable_cache(() => latestIdUncached(game), ["latest", game], { revalidate: TTL.latest, tags: [tagFor(game)] })();
  return cached ?? (await latestIdUncached(game));
}

export function getRound(game: OnchainGame, rid: string) {
  return unstable_cache(() => roundUncached(game, rid), ["round", game, rid], { revalidate: TTL.round, tags: [tagFor(game)] })();
}

export function getBoard(game: OnchainGame, rid: string) {
  return unstable_cache(() => boardUncached(game, rid), ["board", game, rid], { revalidate: TTL.board, tags: [tagFor(game)] })();
}

export function getEntry(game: OnchainGame, rid: string, player: string) {
  return unstable_cache(() => entryUncached(game, rid, player), ["entry", game, rid, player.toLowerCase()], {
    revalidate: TTL.entry,
    tags: [tagFor(game)],
  })();
}

/** Latest round plus its board, or a reason there is none. */
export async function today(game: OnchainGame): Promise<{ round: AnyRound | null; error?: string }> {
  if (!addressFor(game)) return { round: null, error: "contract not deployed yet" };
  try {
    const rid = await latestRoundId(game);
    if (!rid) return { round: null };
    return { round: await getRound(game, rid) };
  } catch (e) {
    return { round: null, error: chainBusy(e) };
  }
}

export function chainBusy(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  return /-32029|rate|429|503|ECONNRESET|fetch failed/i.test(m) ? "the chain is busy, try again in a minute" : "could not read the chain";
}

// ---- transactions ----
export const txKey = (hash: string) => `daily:tx:${hash}`;
export const doneKey = (game: string, rid: string, player: string) => `daily:done:${game}:${rid}:${player.toLowerCase()}`;
export const histKey = (name: string) => `hist:${name.toLowerCase()}`;
const WEEK = 7 * 86400;
const FINAL = ["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"];

export type TxRecord = { game: OnchainGame; round: string; player: string; createdAt: string };

export async function rememberTx(hash: string, rec: TxRecord) {
  await redis.hset(txKey(hash), rec);
  await redis.expire(txKey(hash), WEEK);
}

/**
 * Status of a relayed tx, cached briefly so polling players do not spend the
 * RPC budget. On the first decided outcome it does the bookkeeping once:
 * success awards XP and badges and records history; anything else frees the
 * player's daily:done slot so they can retry (except a duplicate).
 */
export async function statusFor(hash: `0x${string}`, rec: TxRecord): Promise<TxView> {
  const cacheKey = `daily:st:${hash}`;
  const cached = await redis.get<string>(cacheKey);
  if (cached) return JSON.parse(cached) as TxView;

  const view = await txStatus(hash);
  const final = FINAL.includes(view.status) && (view.result || !["ACCEPTED", "FINALIZED"].includes(view.status));
  await redis.set(cacheKey, JSON.stringify(view), { ex: view.status === "FINALIZED" ? WEEK : final ? 20 : 3 });
  if (final && (await redis.set(`daily:settled:${hash}`, 1, { nx: true, ex: WEEK }))) {
    await settle(hash, rec, view);
  }
  return view;
}

async function settle(hash: string, rec: TxRecord, view: TxView) {
  const ok = ["ACCEPTED", "FINALIZED"].includes(view.status) && view.result === "FINISHED_WITH_RETURN";
  revalidateTag(tagFor(rec.game));
  if (!ok) {
    if (!/already (submitted|guessed)/.test(view.error ?? "")) await redis.del(doneKey(rec.game, rec.round, rec.player));
    await pushHistory(rec.player, { ...rec, hash, ok: false, status: view.status, error: view.error ?? view.status });
    return;
  }
  let entry: (VerdictEntry & BridgeEntry) | null = null;
  try {
    const a = addressFor(rec.game);
    if (a && rec.game !== "oracle") {
      const raw = await readRaw(a, ONCHAIN[rec.game].entryFn, [rec.round, rec.player]);
      entry = raw ? JSON.parse(raw) : null;
    }
  } catch {
    /* the entry is shown from the page anyway; XP falls back to the base award */
  }
  await addXp(rec.player, dailyXp(rec.game, entry));
  if (rec.game === "bridge" && entry?.valid && entry.chain?.length === 3) await award(rec.player, "bridge-builder");
  if (rec.game === "verdict") await verdictStreak(rec.player, Number(rec.round));
  await pushHistory(rec.player, {
    ...rec,
    hash,
    ok: true,
    status: view.status,
    score: entry?.score,
    valid: rec.game === "bridge" ? entry?.valid : undefined,
  });
}

async function verdictStreak(player: string, rid: number) {
  const key = `streak:verdict:${player.toLowerCase()}`;
  const prev = await redis.hgetall<{ last?: string; n?: string }>(key);
  const n = prev && Number(prev.last) === rid - 1 ? Number(prev.n ?? 0) + 1 : 1;
  await redis.hset(key, { last: rid, n });
  if (n >= 5) await award(player, "court-regular");
}

export type HistoryItem = TxRecord & {
  hash: string;
  ok: boolean;
  status: string;
  error?: string;
  score?: number;
  valid?: boolean;
};

async function pushHistory(player: string, item: HistoryItem) {
  await redis.lpush(histKey(player), JSON.stringify(item));
  await redis.ltrim(histKey(player), 0, 59);
}

export async function historyOf(player: string): Promise<HistoryItem[]> {
  return (await redis.lrange(histKey(player), 0, 59)).map((s) => (typeof s === "string" ? JSON.parse(s) : s) as HistoryItem);
}

/** The Oracle badge goes to the closest guess once a round is resolved. Idempotent. */
export async function awardOracle(rid: string, round: OracleRound | null, results: OracleResult[]) {
  if (!round || round.state !== "resolved" || !results.length) return;
  if (await redis.set(`oracle:awarded:${rid}`, results[0].player, { nx: true })) {
    await award(results[0].player, "oracle");
  }
}
