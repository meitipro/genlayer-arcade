// lib/ratelimit.ts: per-IP limits for every route that writes (section 8).
// Upstash Ratelimit (sliding window) when Redis is configured; a fixed window
// on the in-memory store otherwise.
import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { redis } from "./redis";

type Window = `${number} ${"s" | "m" | "h"}`;
export type Limiter = { limit(id: string): Promise<{ success: boolean }> };

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const upstash = url && token ? new Redis({ url, token }) : null;

function seconds(w: Window): number {
  const [n, unit] = w.split(" ");
  return Number(n) * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
}

function make(name: string, tokens: number, window: Window): Limiter {
  if (upstash) {
    return new Ratelimit({ redis: upstash, limiter: Ratelimit.slidingWindow(tokens, window), prefix: `arcade:rl:${name}` });
  }
  const ttl = seconds(window);
  return {
    async limit(id: string) {
      const bucket = Math.floor(Date.now() / 1000 / ttl);
      const key = `rl:${name}:${id}:${bucket}`;
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, ttl);
      return { success: n <= tokens };
    },
  };
}

export const limits = {
  claim: make("claim", 5, "1 h"),
  session: make("session", 30, "1 m"),
  score: make("score", 30, "1 m"),
  // spec: 3/hour/IP. DAILY_LIMIT_PER_HOUR raises it for local testing only.
  daily: make("daily", Number(process.env.DAILY_LIMIT_PER_HOUR) || 3, "1 h"),
  admin: make("admin", 30, "1 m"),
  community: make("community", 3, "24 h"),
  faucet: make("faucet", 5, "1 h"),
  rpc: make("rpc", 120, "1 m"),
};

/** The spec's score route imports `ratelimit`; it is the score limiter. */
export const ratelimit = limits.score;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || "anon";
}
