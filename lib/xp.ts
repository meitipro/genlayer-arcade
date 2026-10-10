// lib/xp.ts: XP, levels and the ten badges (section 17, Tier B).
import "server-only";
import { CORE_ARCADE, gameBySlug } from "./games";
import { playerKey } from "./player";
import { redis } from "./redis";

export const BADGES = [
  { id: "first-block", name: "First Block", rule: "finish any arcade game" },
  { id: "online", name: "Online", rule: "play all five arcade games" },
  { id: "finalized", name: "Finalized", rule: "5 perfect drops in one Consensus Stack run" },
  { id: "leader", name: "Leader", rule: "combo x8 in Leader Rotation" },
  { id: "equivalent", name: "Equivalent", rule: "clear level 3 of Equivalence" },
  { id: "long-chain", name: "Long Chain", rule: "finalize 10 blocks in Chain Snake" },
  { id: "court-regular", name: "Court Regular", rule: "submit Daily Verdict 5 days in a row" },
  { id: "bridge-builder", name: "Bridge Builder", rule: "valid 1-hop Word Bridge" },
  { id: "oracle", name: "Oracle", rule: "closest guess in an Oracle round" },
  { id: "season-champion", name: "Season Champion", rule: "#1 on any board when a season is recorded on-chain" },
] as const;
export type BadgeId = (typeof BADGES)[number]["id"];

/** Level n needs 100 x n^1.5 total XP. */
export function levelFor(xp: number): { level: number; next: number; prev: number } {
  let level = 0;
  while (100 * Math.pow(level + 1, 1.5) <= xp) level++;
  return { level, prev: Math.round(100 * Math.pow(level, 1.5)), next: Math.round(100 * Math.pow(level + 1, 1.5)) };
}

export function arcadeXp(slug: string, score: number): number {
  const div = gameBySlug(slug)?.xpDivisor ?? 50;
  return 10 + Math.floor(score / div);
}

const badgeKey = (name: string) => `badges:${name.toLowerCase()}`;

export async function award(name: string, ...ids: BadgeId[]): Promise<BadgeId[]> {
  const fresh: BadgeId[] = [];
  for (const id of ids) if (await redis.sadd(badgeKey(name), id)) fresh.push(id);
  return fresh;
}

export async function badgesOf(name: string): Promise<string[]> {
  return redis.smembers(badgeKey(name));
}

export async function addXp(name: string, xp: number): Promise<number> {
  return redis.hincrby(playerKey(name), "xp", xp);
}

/**
 * After an accepted arcade score. Stats come from the client, so they only
 * unlock badges, and each is capped by what the score itself allows.
 */
export async function afterArcadeRun(name: string, slug: string, score: number, stats: Record<string, number> = {}) {
  const xp = await addXp(name, arcadeXp(slug, score));
  const ids: BadgeId[] = ["first-block"];
  const played = await Promise.all(CORE_ARCADE.map((g) => redis.hget<string>(playerKey(name), `plays:${g.slug}`)));
  if (played.every((p) => Number(p ?? 0) > 0)) ids.push("online");
  const n = (k: string) => (Number.isFinite(Number(stats[k])) ? Number(stats[k]) : 0);
  // a perfect drop is worth 35, so 5 perfects need at least 175 points
  if (slug === "consensus-stack" && n("perfects") >= 5 && score >= 175) ids.push("finalized");
  if (slug === "leader-rotation" && n("maxCombo") >= 8 && score >= 360) ids.push("leader");
  // clearing level 3 means 24 pairs at 100 each
  if (slug === "equivalence" && n("cleared") >= 3 && score >= 2400) ids.push("equivalent");
  // a finalized block is 5 transactions (50) plus 50
  if (slug === "chain-snake" && n("blocks") >= 10 && score >= 1000) ids.push("long-chain");
  const fresh = await award(name, ...ids);
  return { xp, fresh };
}

/** Daily XP: 40 per submission, plus 60 for a valid Bridge or a Verdict of 8 or more. */
export function dailyXp(game: string, entry: { score?: number; valid?: boolean } | null): number {
  if (!entry) return 40;
  if (game === "bridge" && entry.valid) return 100;
  if (game === "verdict" && (entry.score ?? 0) >= 8) return 100;
  return 40;
}
