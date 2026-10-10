// lib/card.ts: everything a player card shows, read in one place. Nothing on a
// card is typed in by the player: Discord comes from OAuth, X and GitHub from
// a bio code, and the arcade numbers from the boards.
import "server-only";
import { historyOf } from "./daily";
import { discordCardOf, discordConfigured, type DiscordCard } from "./discord";
import { ARCADE } from "./games";
import { canonicalName, playerKey } from "./player";
import { redis } from "./redis";
import { socialOf, xConfigured, type SocialProfile } from "./social";
import { badgesOf, levelFor } from "./xp";

export type PlayerCard = {
  name: string;
  since: string | null;
  level: number;
  xp: number;
  badges: number;
  dailies: number;
  best: { game: string; title: string; score: number } | null;
  discord: DiscordCard | null;
  x: SocialProfile | null;
  github: SocialProfile | null;
  wallet: string | null;
  config: { discord: boolean; x: boolean };
};

export async function cardFor(raw: string): Promise<PlayerCard | null> {
  const name = await canonicalName(raw);
  if (!name) return null;
  const [p, badges, history, discord, social, bests] = await Promise.all([
    redis.hgetall<Record<string, string>>(playerKey(name)),
    badgesOf(name),
    historyOf(name),
    discordCardOf(name),
    socialOf(name),
    Promise.all(ARCADE.map(async (g) => ({ g, score: await redis.zscore(`lb:${g.slug}:all`, name) }))),
  ]);
  const xp = Number(p?.xp ?? 0);
  const top = bests.filter((b) => b.score !== null).sort((a, b) => (b.score ?? 0) / (b.g.scoring?.cap ?? 1) - (a.score ?? 0) / (a.g.scoring?.cap ?? 1))[0];
  return {
    name,
    since: p?.createdAt ? new Date(Number(p.createdAt)).toISOString().slice(0, 10) : null,
    level: levelFor(xp).level,
    xp,
    badges: badges.length,
    dailies: history.filter((h) => h.ok).length,
    best: top ? { game: top.g.slug, title: top.g.title, score: top.score ?? 0 } : null,
    discord,
    x: social.x ?? null,
    github: social.github ?? null,
    wallet: p?.wallet || null,
    config: { discord: discordConfigured(), x: xConfigured() },
  };
}
