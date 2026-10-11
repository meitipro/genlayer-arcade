// lib/mee6.ts: a player's server level and XP, from MEE6.
//
// The GenLayer server runs MEE6, whose public leaderboard lists every ranked
// member with level, XP and message count; the reference card project shows the
// same numbers. MEE6 has no per-member lookup, only pages of 1000 sorted by XP,
// so a lookup walks the pages in small parallel batches until the Discord id
// turns up. The answer is kept per Discord id so a card never waits on MEE6.
import "server-only";
import { GENLAYER_GUILD_ID } from "./discord";
import type { ServerStats } from "./cardTypes";
import { redis } from "./redis";

const PAGE = 1000;
const BATCH = 6;
const MAX_PAGES = 60;
const KEEP_SECONDS = 7 * 24 * 3600;

export type Row = { id: string; xp: number; level: number; message_count?: number };
/** null means MEE6 could not be reached for that page. */
export type GetPage = (page: number) => Promise<Row[] | null>;
export type Lookup = { status: "found"; stats: Omit<ServerStats, "at"> } | { status: "absent" } | { status: "unavailable" };

const key = (discordId: string) => `mee6:${discordId}`;

export const fetchMee6Page: GetPage = async (page) => {
  try {
    const r = await fetch(`https://mee6.xyz/api/plugins/levels/leaderboard/${GENLAYER_GUILD_ID}?limit=${PAGE}&page=${page}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { players?: Row[] };
    return Array.isArray(d.players) ? d.players : [];
  } catch {
    return null;
  }
};

/** Walks the leaderboard in order, `BATCH` pages at a time, until the id is found or the board ends. */
export async function findInPages(discordId: string, getPage: GetPage = fetchMee6Page): Promise<Lookup> {
  for (let start = 0; start < MAX_PAGES; start += BATCH) {
    const pages = await Promise.all(Array.from({ length: BATCH }, (_, i) => getPage(start + i)));
    for (let i = 0; i < pages.length; i++) {
      const rows = pages[i];
      if (rows === null) return { status: "unavailable" };
      const at = rows.findIndex((r) => String(r.id) === discordId);
      if (at >= 0) {
        const r = rows[at];
        return { status: "found", stats: { level: Number(r.level) || 0, xp: Number(r.xp) || 0, messages: Number(r.message_count) || 0, rank: (start + i) * PAGE + at + 1 } };
      }
      if (rows.length < PAGE) return { status: "absent" };
    }
  }
  return { status: "absent" };
}

type Stored = (Omit<ServerStats, "at"> & { at: number; absent?: false }) | { absent: true; at: number };

async function stored(discordId: string): Promise<Stored | null> {
  const raw = await redis.get<string>(key(discordId));
  if (!raw) return null;
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as Stored;
  } catch {
    return null;
  }
}

/** What a card shows: null when the player was never read, or is not ranked by MEE6. */
export async function mee6Of(discordId: string): Promise<ServerStats | null> {
  const s = await stored(discordId);
  return s && !s.absent ? s : null;
}

export const REFRESH_AFTER_MS = 30 * 60 * 1000;

/**
 * Reads MEE6 for one member unless the saved answer is newer than 30 minutes.
 * An unreachable MEE6 keeps whatever was saved before.
 */
export async function refreshMee6(discordId: string, getPage: GetPage = fetchMee6Page, now = Date.now()): Promise<{ stats: ServerStats | null; read: boolean }> {
  const before = await stored(discordId);
  if (before && now - before.at < REFRESH_AFTER_MS) return { stats: before.absent ? null : before, read: false };
  const found = await findInPages(discordId, getPage);
  if (found.status === "unavailable") return { stats: before && !before.absent ? before : null, read: false };
  const next: Stored = found.status === "found" ? { ...found.stats, at: now } : { absent: true, at: now };
  await redis.set(key(discordId), JSON.stringify(next), { ex: KEEP_SECONDS });
  return { stats: next.absent ? null : next, read: true };
}
