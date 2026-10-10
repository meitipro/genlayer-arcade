// lib/discord.ts: "Connect Discord". OAuth2 with the identify and
// guilds.members.read scopes, then the player's member object in the GenLayer
// server, whose role IDs lib/roles.ts names and ranks. The access token is used
// once in the callback and never stored.
import "server-only";
import { highestRole, roleNamesFromIds, tierForRole, type Tier } from "./roles";
import { playerKey } from "./player";
import { redis } from "./redis";

/** The GenLayer server, read from its public invite discord.gg/genlayerlabs. */
export const GENLAYER_GUILD_ID = process.env.DISCORD_GUILD_ID || "1237055789441487021";
const API = "https://discord.com/api/v10";

export type DiscordCard = {
  id: string;
  username: string;
  avatar: string | null;
  isMember: boolean;
  highestRole: string;
  tier: Tier;
  roles: string[];
  joinedAt: string | null;
  connectedAt: string;
};

export function discordConfigured(): boolean {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

/** Playing needs a connected Discord once the app is configured (ARCADE_REQUIRE_DISCORD=0 turns that off). */
export function discordRequired(): boolean {
  return discordConfigured() && process.env.ARCADE_REQUIRE_DISCORD !== "0";
}

export function redirectUri(origin: string): string {
  return process.env.DISCORD_REDIRECT_URI || `${origin}/api/discord/callback`;
}

export function authorizeUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: redirectUri(origin),
    scope: "identify guilds.members.read",
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${q}`;
}

export function discordAvatarUrl(userId: string, hash: string | null | undefined): string | null {
  if (!userId) return null;
  if (hash) return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=256`;
  let index = 0;
  try {
    index = Number((BigInt(userId) >> BigInt(22)) % BigInt(6));
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export async function exchangeCode(code: string, origin: string): Promise<string> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID ?? "",
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(origin),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const d = (await res.json()) as { access_token?: string };
  if (!d.access_token) throw new Error("no access token");
  return d.access_token;
}

/** Who the user is, and their roles in the GenLayer server (empty when not a member). */
export async function fetchStanding(accessToken: string): Promise<DiscordCard> {
  const me = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!me.ok) throw new Error(`users/@me failed: ${me.status}`);
  const u = (await me.json()) as { id: string; username?: string; global_name?: string | null; avatar?: string | null };
  const base = {
    id: u.id,
    username: u.global_name || u.username || "",
    avatar: discordAvatarUrl(u.id, u.avatar),
    connectedAt: new Date().toISOString(),
  };
  const res = await fetch(`${API}/users/@me/guilds/${GENLAYER_GUILD_ID}/member`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) {
    const top = highestRole([]);
    return { ...base, isMember: false, highestRole: top.name, tier: tierForRole(top.name), roles: [], joinedAt: null };
  }
  const m = (await res.json()) as { roles?: string[]; joined_at?: string };
  const ids = m.roles ?? [];
  const top = highestRole(ids);
  return { ...base, isMember: true, highestRole: top.name, tier: tierForRole(top.name), roles: roleNamesFromIds(ids), joinedAt: m.joined_at ?? null };
}

const cardKey = (name: string) => `card:discord:${name.toLowerCase()}`;
const userKey = (discordId: string) => `discord:user:${discordId}`;

/** Links a Discord account to a nickname. One Discord account plays under one nickname. */
export async function linkDiscord(name: string, card: DiscordCard): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await redis.get<string>(userKey(card.id));
  if (owner && owner.toLowerCase() !== name.toLowerCase()) return { ok: false, error: "taken" };
  const previous = await redis.hget<string>(playerKey(name), "discordId");
  if (previous && previous !== card.id) await redis.del(userKey(previous));
  await redis.set(userKey(card.id), name);
  await redis.hset(playerKey(name), { discordId: card.id });
  await redis.set(cardKey(name), JSON.stringify(card));
  return { ok: true };
}

export async function unlinkDiscord(name: string): Promise<void> {
  const id = await redis.hget<string>(playerKey(name), "discordId");
  if (id) await redis.del(userKey(id));
  await redis.hset(playerKey(name), { discordId: "" });
  await redis.del(cardKey(name));
}

export async function discordCardOf(name: string): Promise<DiscordCard | null> {
  const raw = await redis.get<string>(cardKey(name));
  return raw ? ((typeof raw === "string" ? JSON.parse(raw) : raw) as DiscordCard) : null;
}

/** Null when the player may play; otherwise the sentence to show. */
export async function discordGate(name: string): Promise<string | null> {
  if (!discordRequired()) return null;
  // wallet players are bound to their address instead
  if (/^w_[0-9a-f]{18}$/.test(name)) return null;
  const id = await redis.hget<string>(playerKey(name), "discordId");
  return id ? null : "connect your Discord on My Card to play";
}
