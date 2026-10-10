// lib/community.ts: community game submissions, reviewed on-chain by the
// GameReview contract (contracts/game_review.py). Same relayer and polling
// pattern as the daily games.
import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { contractAddress, readRaw, relayWrite, txStatus, type TxView } from "./genlayer";
import { redis } from "./redis";

export type Review = {
  id: string;
  title: string;
  url: string;
  player: string;
  label: "PLAYABLE" | "NOT_A_GAME" | "UNREACHABLE";
  reason: string;
  listed: boolean;
  rechecked: boolean;
  delisted?: string;
  hash?: string | null;
};

export const URL_RE = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/[^\s<>"']*)?$/;
const TAG = "community";
const WEEK = 7 * 86400;

export const reviewAddress = () => contractAddress("REVIEW_CONTRACT");
const urlKey = (url: string) => `community:url:${url}`;
const txKey = (hash: string) => `community:tx:${hash}`;

export function validateSubmission(title: unknown, url: unknown): string | null {
  const t = String(title ?? "").trim();
  const u = String(url ?? "").trim();
  if (t.length < 3 || t.length > 60) return "title must be 3 to 60 characters";
  if (u.length > 200 || !URL_RE.test(u)) return "link must be a plain https URL to the game page";
  return null;
}

async function listUncached(): Promise<Review[]> {
  const a = reviewAddress();
  if (!a) return [];
  const raw = await readRaw(a, "list_games", ["0", "50"]);
  const rows = (raw ? JSON.parse(raw) : []) as Review[];
  const hashes = await Promise.all(rows.map((r) => redis.get<string>(urlKey(r.url))));
  return rows.map((r, i) => ({ ...r, hash: hashes[i]?.startsWith("0x") ? hashes[i] : null }));
}

export const listReviews = () => unstable_cache(listUncached, ["community-reviews"], { revalidate: 60, tags: [TAG] })();

export async function submitGame(player: string, title: string, url: string): Promise<{ hash: string } | { error: string; status: number }> {
  const a = reviewAddress();
  if (!a) return { error: "the review contract is not deployed yet", status: 503 };
  const u = url.trim();
  // one review per link, claimed before the relayer spends anything
  if (!(await redis.set(urlKey(u), "pending", { nx: true }))) return { error: "that link was already submitted", status: 409 };
  try {
    const hash = await relayWrite(a, "submit_game", [player, title.trim(), u]);
    await redis.set(urlKey(u), hash);
    await redis.hset(txKey(hash), { player, title: title.trim(), url: u, createdAt: new Date().toISOString() });
    await redis.expire(txKey(hash), 30 * 86400);
    return { hash };
  } catch (e) {
    await redis.del(urlKey(u));
    console.error("submit_game relay failed", String((e as Error)?.message ?? e).slice(0, 300));
    return { error: "not sent, try again in a minute", status: 503 };
  }
}

export async function reviewTx(hash: string) {
  return redis.hgetall<{ player: string; title: string; url: string; createdAt: string }>(txKey(hash));
}

/** Status of a submission tx, cached briefly; frees the link for another try when nothing was recorded. */
export async function reviewStatus(hash: `0x${string}`, url: string): Promise<TxView> {
  const cacheKey = `community:st:${hash}`;
  const cached = await redis.get<string>(cacheKey);
  if (cached) return JSON.parse(cached) as TxView;
  const view = await txStatus(hash);
  const decided = ["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED"].includes(view.status) && (view.result || !["ACCEPTED", "FINALIZED"].includes(view.status));
  await redis.set(cacheKey, JSON.stringify(view), { ex: decided ? 30 : 3 });
  if (decided && (await redis.set(`community:settled:${hash}`, 1, { nx: true, ex: WEEK }))) {
    revalidateTag(TAG);
    const ok = ["ACCEPTED", "FINALIZED"].includes(view.status) && view.result === "FINISHED_WITH_RETURN";
    if (!ok && !/already submitted/.test(view.error ?? "")) await redis.del(urlKey(url));
  }
  return view;
}

export async function recheckReview(gid: string) {
  const a = reviewAddress();
  if (!a) throw new Error("GameReview is not deployed");
  return relayWrite(a, "recheck", [gid]);
}

export async function delistReview(gid: string, reason: string) {
  const a = reviewAddress();
  if (!a) throw new Error("GameReview is not deployed");
  return relayWrite(a, "delist", [gid, reason.slice(0, 200)]);
}

export const dropCommunityCache = () => revalidateTag(TAG);
