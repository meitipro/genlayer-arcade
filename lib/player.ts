// lib/player.ts: nicknames with a device secret, no wallet (section 8).
import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { redis } from "./redis";

export const NAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function pepper(): string {
  const p = process.env.PLAYER_PEPPER;
  if (p) return p;
  if (process.env.VERCEL_ENV === "production") throw new Error("PLAYER_PEPPER is not set");
  return "dev-only-pepper";
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret + pepper()).digest("hex");
}

/** Names are unique case-insensitively; the stored key is lowercase, the display name keeps its case. */
export const playerKey = (name: string) => `player:${name.toLowerCase()}`;

export type Claim = { ok: true; name: string; secret: string } | { ok: false; error: string; status: number };

export async function claimName(name: string): Promise<Claim> {
  if (!NAME_RE.test(name)) return { ok: false, error: "use 3 to 20 letters, digits or underscores", status: 400 };
  // w_ followed by 18 hex digits is the name of a wallet (lib/wallet.ts)
  if (/^w_[0-9a-f]{18}$/i.test(name)) return { ok: false, error: "names like w_ plus 18 hex digits belong to wallets", status: 400 };
  const secret = randomBytes(32).toString("hex");
  // Reserve the name atomically, then write the record.
  const reserved = await redis.set(`name:${name.toLowerCase()}`, name, { nx: true });
  if (!reserved) return { ok: false, error: "that name is taken, pick another", status: 409 };
  await redis.hset(playerKey(name), { name, secretHash: hashSecret(secret), createdAt: Date.now(), xp: 0 });
  return { ok: true, name, secret };
}

/** The canonical display name for a claimed nickname, or null. */
export async function canonicalName(name: string): Promise<string | null> {
  if (typeof name !== "string" || !NAME_RE.test(name)) return null;
  return (await redis.get<string>(`name:${name.toLowerCase()}`)) ?? null;
}

export async function verifyPlayer(name: unknown, secret: unknown): Promise<string | null> {
  if (typeof name !== "string" || typeof secret !== "string" || !NAME_RE.test(name) || !/^[0-9a-f]{64}$/.test(secret)) return null;
  const stored = await redis.hget<string>(playerKey(name), "secretHash");
  if (!stored) return null;
  const want = Buffer.from(stored, "hex");
  const got = Buffer.from(hashSecret(secret), "hex");
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return (await redis.hget<string>(playerKey(name), "name")) ?? name;
}
