// Test helpers: a player who has signed in with Discord, as a Cookie header.
import { loginWithDiscord } from "@/lib/discord";
import { tierForRole } from "@/lib/roles";
import { SESSION_COOKIE, signSessionCookie } from "@/lib/sessionCookie";

export async function loginAs(username: string, opts: { id?: string; role?: string; member?: boolean } = {}) {
  const id = opts.id ?? `test-${username}`;
  const role = opts.role ?? "Mindbender";
  const name = await loginWithDiscord({
    id,
    username,
    avatar: null,
    isMember: opts.member ?? true,
    highestRole: role,
    tier: tierForRole(role),
    roles: [role],
    joinedAt: "2025-01-01T00:00:00Z",
    connectedAt: "2026-10-11T00:00:00Z",
  });
  const value = await signSessionCookie({ name, did: id });
  return { name, id, cookie: `${SESSION_COOKIE}=${encodeURIComponent(value)}` };
}

export function jsonPost(url: string, body: unknown, opts: { cookie?: string; ip?: string; headers?: Record<string, string> } = {}) {
  return new Request(`http://t${url}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": opts.ip ?? "10.0.0.1",
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}
