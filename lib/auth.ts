// lib/auth.ts: who is making this request. The answer is the player named in a
// valid session cookie whose Discord account still owns that name.
import "server-only";
import { playerKey } from "./player";
import { redis } from "./redis";
import { cookieFromHeader, readSessionCookie, SESSION_COOKIE, SESSION_MAX_AGE_S, setCookieHeader, signSessionCookie } from "./sessionCookie";

/** The signed-in player's name, or null. */
export async function sessionPlayer(req: Request): Promise<string | null> {
  const s = await readSessionCookie(cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE));
  if (!s) return null;
  const owner = await redis.hget<string>(playerKey(s.name), "discordId");
  if (!owner || owner !== s.did) return null;
  return (await redis.hget<string>(playerKey(s.name), "name")) ?? s.name;
}

export const isHttps = (req: Request) => new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

export async function sessionCookieFor(req: Request, name: string, discordId: string): Promise<string> {
  return setCookieHeader(SESSION_COOKIE, await signSessionCookie({ name, did: discordId }), SESSION_MAX_AGE_S, isHttps(req));
}

export const clearedSessionCookie = (req: Request) => setCookieHeader(SESSION_COOKIE, "", 0, isHttps(req));
