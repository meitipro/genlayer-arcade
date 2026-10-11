// lib/loginState.ts: the two short-lived cookies of the Discord login round trip.
export const STATE_COOKIE = "arcade_oauth_state";
export const NEXT_COOKIE = "arcade_next";

/** Only a path on this site: starts with one slash, no scheme, no backslash, not the login or API routes. */
export function safeNext(raw: string | null | undefined): string {
  const n = String(raw ?? "");
  if (!n.startsWith("/") || n.startsWith("//") || n.includes("\\") || n.length > 300) return "/";
  if (n.startsWith("/login") || n.startsWith("/api/")) return "/";
  return n;
}
