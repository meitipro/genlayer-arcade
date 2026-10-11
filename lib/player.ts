// lib/player.ts: a player is a Discord account. The name is made once, from the
// Discord username, when the account first logs in, and is the name on the
// boards. There is no separate signup and no device secret.
import "server-only";
import { redis } from "./redis";

export const NAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
/** A name of this shape belongs to a wallet (lib/wallet.ts), never to a Discord account. */
const WALLET_SHAPE = /^w_[0-9a-f]{18}$/i;

/** Names are unique case-insensitively; the stored key is lowercase, the display name keeps its case. */
export const playerKey = (name: string) => `player:${name.toLowerCase()}`;

/** The canonical display name for an existing player, or null. */
export async function canonicalName(name: string): Promise<string | null> {
  if (typeof name !== "string" || !NAME_RE.test(name)) return null;
  return (await redis.get<string>(`name:${name.toLowerCase()}`)) ?? null;
}

/** A readable, valid name from a Discord username: letters, digits and underscores, 3 to 17 characters. */
export function baseName(username: string): string {
  let n = String(username ?? "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 17);
  if (n.length < 3) n = (n + "_arcade").slice(0, 17);
  if (WALLET_SHAPE.test(n)) n = "p_" + n.slice(2);
  return n;
}

/** Reserves a free name for this Discord account and creates the player record. */
export async function createPlayer(username: string, discordId: string): Promise<string> {
  const base = baseName(username);
  for (let i = 0; i < 20; i++) {
    const suffix = i === 0 ? "" : String(Math.floor(Math.random() * 10 ** Math.min(4, 1 + i)));
    const name = (base.slice(0, 20 - suffix.length) + suffix).slice(0, 20);
    if (!NAME_RE.test(name) || WALLET_SHAPE.test(name)) continue;
    if (await redis.set(`name:${name.toLowerCase()}`, name, { nx: true })) {
      await redis.hset(playerKey(name), { name, createdAt: Date.now(), xp: 0, discordId });
      return name;
    }
  }
  throw new Error("no free name for this account");
}
