// lib/social.ts: the player's X handle on the card. It is optional: the site
// works without it. A handle only appears as verified after a short code the
// holder put in their X bio or location was seen, through twitterapi.io
// (TWITTERAPI_KEY). The code can be removed right after.
import "server-only";
import { randomInt } from "crypto";
import { redis } from "./redis";

export type Network = "x";
export type SocialProfile = {
  network: Network;
  handle: string;
  name: string;
  avatar: string | null;
  url: string;
  followers: number | null;
  since: string | null;
  verifiedAt: string;
};

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
const challengeKey = (name: string, n: Network) => `social:challenge:${name.toLowerCase()}:${n}`;
const socialKey = (name: string) => `card:social:${name.toLowerCase()}`;
const ownerKey = (n: Network, handle: string) => `social:owner:${n}:${handle.toLowerCase()}`;

export function cleanHandle(_network: Network, raw: unknown): string | null {
  const h = String(raw ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, "")
    .replace(/\/.*$/, "");
  return HANDLE_RE.test(h) ? h : null;
}

export function xConfigured(): boolean {
  return Boolean(process.env.TWITTERAPI_KEY);
}

export async function startChallenge(name: string, network: Network, handle: string): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = `GLA-${Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("")}`;
  await redis.set(challengeKey(name, network), JSON.stringify({ handle, code }), { ex: 1800 });
  return code;
}

async function fetchProfile(handle: string): Promise<(Omit<SocialProfile, "verifiedAt"> & { text: string }) | null> {
  const key = process.env.TWITTERAPI_KEY;
  if (!key) throw new Error("X verification is not configured on this site yet");
  const r = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(handle)}`, { headers: { "X-API-Key": key }, cache: "no-store" });
  if (!r.ok) return null;
  const d = ((await r.json()) as { data?: Record<string, unknown> }).data;
  if (!d?.userName) return null;
  return {
    network: "x",
    handle: String(d.userName),
    name: String(d.name || d.userName),
    avatar: String(d.profilePicture || "").replace("_normal", "") || null,
    url: `https://x.com/${d.userName}`,
    followers: typeof d.followers === "number" ? d.followers : null,
    since: (d.createdAt as string) || null,
    text: `${d.description ?? ""} ${d.location ?? ""}`,
  };
}

export async function verifyChallenge(name: string, network: Network): Promise<{ ok: true; profile: SocialProfile } | { ok: false; error: string }> {
  const raw = await redis.get<string>(challengeKey(name, network));
  if (!raw) return { ok: false, error: "start again: the code expired after 30 minutes" };
  const { handle, code } = JSON.parse(raw) as { handle: string; code: string };
  const p = await fetchProfile(handle);
  if (!p) return { ok: false, error: `could not read @${handle} on X` };
  if (!p.text.toUpperCase().includes(code)) return { ok: false, error: `${code} is not in the bio or location of @${p.handle} yet` };
  const owner = await redis.get<string>(ownerKey(network, p.handle));
  if (owner && owner.toLowerCase() !== name.toLowerCase()) return { ok: false, error: `@${p.handle} is already on another card` };
  const { text: _text, ...profile } = p;
  void _text;
  const full: SocialProfile = { ...profile, verifiedAt: new Date().toISOString() };
  const all = await socialOf(name);
  const prev = all[network];
  if (prev && prev.handle.toLowerCase() !== full.handle.toLowerCase()) await redis.del(ownerKey(network, prev.handle));
  await redis.set(ownerKey(network, full.handle), name);
  await redis.set(socialKey(name), JSON.stringify({ ...all, [network]: full }));
  await redis.del(challengeKey(name, network));
  return { ok: true, profile: full };
}

export async function socialOf(name: string): Promise<Partial<Record<Network, SocialProfile>>> {
  const raw = await redis.get<string>(socialKey(name));
  return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
}

export async function removeSocial(name: string, network: Network): Promise<void> {
  const all = await socialOf(name);
  if (all[network]) await redis.del(ownerKey(network, all[network]!.handle));
  delete all[network];
  await redis.set(socialKey(name), JSON.stringify(all));
}
