// lib/redis.ts: the one place that touches Redis.
//
// Production uses Upstash Redis (UPSTASH_REDIS_REST_URL / _TOKEN, or the
// KV_REST_API_* names the Vercel Marketplace integration sets). The store can be
// shared with other projects, so every key is prefixed with "arcade:".
//
// Without those env vars (local dev, tests) an in-memory store with the same
// surface is used. It is per-process and forgets everything on restart, so it is
// refused in production builds unless ARCADE_ALLOW_MEMORY=1.
import "server-only";
import { Redis } from "@upstash/redis";

const PREFIX = "arcade:";
export const k = (key: string) => PREFIX + key;

type SetOpts = { nx?: boolean; ex?: number };
type ZMember = { score: number; member: string };

export interface Store {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: string | number, opts?: SetOpts): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  hset(key: string, values: Record<string, string | number>): Promise<number>;
  hget<T = string>(key: string, field: string): Promise<T | null>;
  hgetall<T = Record<string, string>>(key: string): Promise<T | null>;
  hincrby(key: string, field: string, by: number): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<number>;
  /** ZADD with GT: only raises a member's score. */
  zaddGt(key: string, entry: ZMember): Promise<number>;
  /** Highest first, with scores. */
  ztop(key: string, count: number): Promise<ZMember[]>;
  zscore(key: string, member: string): Promise<number | null>;
  /** 0-based rank, highest first. */
  zrevrank(key: string, member: string): Promise<number | null>;
  zcard(key: string): Promise<number>;
  zrem(key: string, member: string): Promise<number>;
  lpush(key: string, value: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<"OK">;
}

function upstash(url: string, token: string): Store {
  const r = new Redis({ url, token, automaticDeserialization: false });
  const pairs = (flat: (string | number)[]): ZMember[] => {
    const out: ZMember[] = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
    return out;
  };
  return {
    get: async (key) => (await r.get(k(key))) as never,
    set: async (key, value, o = {}) => {
      const opts: Record<string, unknown> = {};
      if (o.nx) opts.nx = true;
      if (o.ex) opts.ex = o.ex;
      return (await r.set(k(key), String(value), opts as never)) as "OK" | null;
    },
    del: (...keys) => r.del(...keys.map(k)),
    incr: (key) => r.incr(k(key)),
    expire: (key, s) => r.expire(k(key), s),
    hset: (key, values) => r.hset(k(key), values),
    hget: async (key, field) => (await r.hget(k(key), field)) as never,
    hgetall: async (key) => (await r.hgetall(k(key))) as never,
    hincrby: (key, field, by) => r.hincrby(k(key), field, by),
    sadd: (key, ...members) => (r.sadd as (key: string, ...m: string[]) => Promise<number>)(k(key), ...members),
    smembers: (key) => r.smembers(k(key)),
    sismember: (key, m) => r.sismember(k(key), m),
    zaddGt: async (key, e) => (await r.zadd(k(key), { gt: true }, e)) ?? 0,
    ztop: async (key, count) => pairs(await r.zrange(k(key), 0, count - 1, { rev: true, withScores: true })),
    zscore: async (key, m) => {
      const s = await r.zscore(k(key), m);
      return s === null || s === undefined ? null : Number(s);
    },
    zrevrank: (key, m) => r.zrevrank(k(key), m),
    zcard: (key) => r.zcard(k(key)),
    zrem: (key, m) => r.zrem(k(key), m),
    lpush: (key, v) => r.lpush(k(key), v),
    lrange: (key, a, b) => r.lrange(k(key), a, b),
    ltrim: (key, a, b) => r.ltrim(k(key), a, b) as Promise<"OK">,
  };
}

/** In-memory twin of the surface above, for local dev and tests. */
export function memoryStore(): Store {
  const kv = new Map<string, { v: string; exp?: number }>();
  const hashes = new Map<string, Map<string, string>>();
  const sets = new Map<string, Set<string>>();
  const zsets = new Map<string, Map<string, number>>();
  const lists = new Map<string, string[]>();
  const live = (key: string) => {
    const e = kv.get(key);
    if (e && e.exp && e.exp < Date.now()) kv.delete(key);
    return kv.get(key);
  };
  const zsorted = (key: string) =>
    [...(zsets.get(key) ?? new Map()).entries()]
      // highest first; ties: lexicographically larger member first, as Redis ZREVRANGE does
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([member, score]) => ({ member, score }));
  return {
    get: async (key) => (live(key)?.v ?? null) as never,
    set: async (key, value, o = {}) => {
      if (o.nx && live(key)) return null;
      kv.set(key, { v: String(value), exp: o.ex ? Date.now() + o.ex * 1000 : undefined });
      return "OK";
    },
    del: async (...keys) => {
      let n = 0;
      for (const key of keys) for (const m of [kv, hashes, sets, zsets, lists] as Map<string, unknown>[]) if (m.delete(key)) n++;
      return n;
    },
    incr: async (key) => {
      const n = Number(live(key)?.v ?? 0) + 1;
      kv.set(key, { v: String(n), exp: kv.get(key)?.exp });
      return n;
    },
    expire: async (key, s) => {
      const e = live(key);
      if (!e) return 0;
      e.exp = Date.now() + s * 1000;
      return 1;
    },
    hset: async (key, values) => {
      const h = hashes.get(key) ?? new Map();
      let n = 0;
      for (const [f, v] of Object.entries(values)) {
        if (!h.has(f)) n++;
        h.set(f, String(v));
      }
      hashes.set(key, h);
      return n;
    },
    hget: async (key, f) => (hashes.get(key)?.get(f) ?? null) as never,
    hgetall: async (key) => {
      const h = hashes.get(key);
      return (h && h.size ? Object.fromEntries(h) : null) as never;
    },
    hincrby: async (key, f, by) => {
      const h = hashes.get(key) ?? new Map();
      const n = Number(h.get(f) ?? 0) + by;
      h.set(f, String(n));
      hashes.set(key, h);
      return n;
    },
    sadd: async (key, ...members) => {
      const s = sets.get(key) ?? new Set();
      let n = 0;
      for (const m of members)
        if (!s.has(m)) {
          s.add(m);
          n++;
        }
      sets.set(key, s);
      return n;
    },
    smembers: async (key) => [...(sets.get(key) ?? [])],
    sismember: async (key, m) => (sets.get(key)?.has(m) ? 1 : 0),
    zaddGt: async (key, e) => {
      const z = zsets.get(key) ?? new Map();
      const had = z.get(e.member);
      if (had === undefined) {
        z.set(e.member, e.score);
        zsets.set(key, z);
        return 1;
      }
      if (e.score > had) z.set(e.member, e.score);
      zsets.set(key, z);
      return 0;
    },
    ztop: async (key, count) => zsorted(key).slice(0, count),
    zscore: async (key, m) => zsets.get(key)?.get(m) ?? null,
    zrevrank: async (key, m) => {
      const i = zsorted(key).findIndex((x) => x.member === m);
      return i < 0 ? null : i;
    },
    zcard: async (key) => zsets.get(key)?.size ?? 0,
    zrem: async (key, m) => (zsets.get(key)?.delete(m) ? 1 : 0),
    lpush: async (key, v) => {
      const l = lists.get(key) ?? [];
      l.unshift(v);
      lists.set(key, l);
      return l.length;
    },
    lrange: async (key, a, b) => {
      const l = lists.get(key) ?? [];
      return l.slice(a, b < 0 ? l.length + b + 1 : b + 1);
    },
    ltrim: async (key, a, b) => {
      const l = lists.get(key) ?? [];
      lists.set(key, l.slice(a, b < 0 ? l.length + b + 1 : b + 1));
      return "OK";
    },
  };
}

function make(): Store {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return upstash(url, token);
  if (process.env.VERCEL_ENV === "production" && process.env.ARCADE_ALLOW_MEMORY !== "1") {
    throw new Error("Redis is not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
  }
  return memoryStore();
}

const g = globalThis as unknown as { __arcadeStore?: Store };
export const redis: Store = (g.__arcadeStore ??= make());
export const usingMemory = !(
  (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
  (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
);
