// lib/sessionCookie.ts: the signed login cookie. Written with Web Crypto only,
// so the same code runs in middleware (Edge) and in route handlers (Node).
//
// The cookie is the whole login: it names the player and the Discord account
// behind them, is signed with SESSION_SECRET, and is HttpOnly. There is no
// password and no device secret.

export const SESSION_COOKIE = "arcade_session";
export const SESSION_MAX_AGE_S = 30 * 24 * 3600;

export type SessionData = { name: string; did: string };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.VERCEL_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return "dev-only-session-secret";
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body))));
}

export async function signSessionCookie(data: SessionData, now = Date.now()): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ n: data.name, d: data.did, t: now })));
  return `${body}.${await sign(body)}`;
}

export async function readSessionCookie(value: string | null | undefined, now = Date.now()): Promise<SessionData | null> {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const want = await sign(body);
  if (sig.length !== want.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= sig.charCodeAt(i) ^ want.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as { n?: string; d?: string; t?: number };
    if (typeof p.n !== "string" || typeof p.d !== "string" || typeof p.t !== "number") return null;
    if (p.t > now + 60000 || now - p.t > SESSION_MAX_AGE_S * 1000) return null;
    return { name: p.n, did: p.d };
  } catch {
    return null;
  }
}

/** One cookie out of a Cookie request header. */
export function cookieFromHeader(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function setCookieHeader(name: string, value: string, maxAgeS: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
