// lib/boards.ts: arcade season and all-time boards from Redis.
import "server-only";
import { gameBySlug } from "./games";
import { redis } from "./redis";
import { seasonId } from "./season";

export type BoardRow = { rank: number; player: string; score: number };
export type Board = { game: string; scope: "season" | "all"; season: string; rows: BoardRow[]; you?: BoardRow | null };

export async function boardFor(slug: string, scope: string, season?: string, player?: string, size = 50): Promise<Board | null> {
  const g = gameBySlug(slug);
  if (!g?.scoring) return null;
  const sc = scope === "all" ? "all" : "season";
  const sid = season && /^\d{4}-W\d{2}$/.test(season) ? season : seasonId();
  const key = `lb:${g.slug}:${sc === "all" ? "all" : sid}`;
  const top = await redis.ztop(key, size);
  const rows = top.map((r, i) => ({ rank: i + 1, player: r.member, score: r.score }));
  let you: BoardRow | null | undefined;
  if (player) {
    const name = rows.find((r) => r.player.toLowerCase() === player.toLowerCase())?.player ?? (await redis.get<string>(`name:${player.toLowerCase()}`));
    if (name) {
      const [rank, score] = await Promise.all([redis.zrevrank(key, name), redis.zscore(key, name)]);
      you = rank === null || score === null ? null : { rank: rank + 1, player: name, score };
    }
  }
  return { game: g.slug, scope: sc, season: sid, rows, you };
}
