// lib/card.ts: everything a player card shows, read in one place. Nothing on a
// card is typed in by the player: Discord comes from OAuth, X from a bio code,
// and the arcade numbers from the boards.
import "server-only";
import { createHash } from "crypto";
import { historyOf } from "./daily";
import { discordCardOf, discordConfigured } from "./discord";
import { ARCADE } from "./games";
import { canonicalName, playerKey } from "./player";
import { redis } from "./redis";
import { socialOf, xConfigured } from "./social";
import type { PlayerCard } from "./cardTypes";
import { tierForRole } from "./roles";
import { badgesOf, levelFor } from "./xp";

export type { PlayerCard } from "./cardTypes";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

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
  const top = bests
    .filter((b) => b.score !== null)
    .sort((a, b) => (b.score ?? 0) / (b.g.scoring?.cap ?? 1) - (a.score ?? 0) / (a.g.scoring?.cap ?? 1))[0];
  const level = levelFor(xp).level;
  const x = social.x ?? null;

  // Tier comes from the highest GenLayer server role. Without a role to read
  // (not connected, or not in the server) the card is Spark, as in the original.
  const member = Boolean(discord?.isMember);
  const tier = member && discord ? tierForRole(discord.highestRole) : tierForRole("Mindbender");
  const standing = !discord ? "Not connected" : member ? discord.highestRole : "Not in the server";

  const idHash = sha(`${name.toLowerCase()}|${discord?.id ?? ""}`);
  const credentialNo = `${idHash.slice(0, 4)}-${idHash.slice(4, 8)}`.toUpperCase();
  const record = JSON.stringify({
    name,
    discord: discord?.id ?? null,
    roles: discord?.roles ?? [],
    highest: discord?.highestRole ?? null,
    x: x?.handle ?? null,
    level,
  });
  const recordHash = "0x" + sha(record).slice(0, 40);

  return {
    name,
    since: p?.createdAt ? new Date(Number(p.createdAt)).toISOString().slice(0, 10) : null,
    level,
    xp,
    badges: badges.length,
    dailies: history.filter((h) => h.ok).length,
    best: top ? { game: top.g.slug, title: top.g.title, score: top.score ?? 0 } : null,
    discord,
    x,
    wallet: p?.wallet || null,
    config: { discord: discordConfigured(), x: xConfigured() },
    tier: { n: tier.n, name: tier.name },
    standing,
    credentialNo,
    recordHash,
    seed: `${discord?.id ?? name}#${discord?.highestRole ?? "Mindbender"}`,
  };
}
