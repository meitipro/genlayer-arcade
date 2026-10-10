// lib/session.ts: signed one-use play sessions (section 8).
import { createHmac, randomUUID, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.VERCEL_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return "dev-only-session-secret";
}

export type Session = { sid: string; game: string; t: number; room?: string };

/** room: the id of a live event whose room code started this run (tournament mode). */
export function signSession(game: string, now = Date.now(), room?: string) {
  const payload: Session = { sid: randomUUID(), game, t: now, ...(room ? { room } : {}) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: unknown): Session | null {
  if (typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (typeof s.sid !== "string" || typeof s.game !== "string" || typeof s.t !== "number") return null;
    return s;
  } catch {
    return null;
  }
}
