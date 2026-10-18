import "server-only";

import { unstable_cache } from "next/cache";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

import { CONTRACT, deployed } from "./deployment";
import { RPC } from "./network";
import type { Appeal, Court, Page } from "./types";

/**
 * Every chain read the site makes, server side, with no account: the client
 * cannot sign anything even by mistake.
 *
 * Rule 28: the RPC is a budget shared by every visitor. Reads are cached for
 * 15 seconds under one tag, and /api/revalidate drops the tag the moment a
 * write is decided, so the person who wrote sees their own result.
 */
export const TAG = "unban-chain";

const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: [RPC] } } } as typeof studioDevnet;
let client: ReturnType<typeof createClient> | null = null;

function reader() {
  if (!client) client = createClient({ chain });
  return client;
}

export class ChainError extends Error {}

function isTransient(error: unknown): boolean {
  return /fetch failed|ECONNRESET|socket|network|timed out|timeout|busy|-32006|-32029|rate limit|429|502|503|504/i.test(String((error as Error)?.message ?? error));
}

async function raw(functionName: string, args: (string | number)[]): Promise<string> {
  if (!deployed) throw new ChainError("not_deployed");
  let wait = 600;
  for (let attempt = 1; ; attempt++) {
    try {
      const out = await reader().readContract({ address: CONTRACT as `0x${string}`, functionName, args });
      return String(out);
    } catch (error) {
      const text = String((error as Error)?.message ?? error);
      // A view that raises answers "execution failed" without its message: that is "not found".
      if (/execution failed|unknown (court|appeal)/i.test(text)) throw new ChainError("not_found");
      if (attempt >= 4 || !isTransient(error)) throw new ChainError(/-32029|rate limit/i.test(text) ? "rate_limited" : "unreachable");
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
}

const cached = unstable_cache(raw, ["unban-read"], { revalidate: 15, tags: [TAG] });

async function json<T>(fn: string, args: (string | number)[]): Promise<T> {
  return JSON.parse(await cached(fn, args)) as T;
}

export const getCourt = (id: number) => json<Court>("get_court", [id]);
export const getAppeal = (id: number) => json<Appeal>("get_appeal", [id]);
export const listAppeals = (courtId: number, status: string, offset: number, limit: number) =>
  json<Page>("list_appeals", [courtId, status, offset, limit]);

/**
 * Every court, newest first, up to `max`. One read per court, so the cap keeps
 * a cold page under a dozen RPC calls (rule 28); the cache serves the rest.
 */
export async function allCourts(max = 12): Promise<Court[]> {
  const head = await listAppeals(0, "", 0, 1);
  const count = Math.min(head.courts, max);
  const ids = Array.from({ length: count }, (_, i) => head.courts - i);
  const out: Court[] = [];
  for (const id of ids) out.push(await getCourt(id));
  return out;
}

/** A plain-language sentence for a failed read, shown instead of data. */
export function why(error: unknown): string {
  const code = error instanceof ChainError ? error.message : "unreachable";
  if (code === "not_deployed") return "The Unban contract has not been deployed for this site yet.";
  if (code === "not_found") return "That does not exist on the contract.";
  if (code === "rate_limited") return "Studio Next is limiting requests right now. Wait a minute and reload.";
  return "Studio Next did not answer just now. Reload in a moment; nothing on chain has changed.";
}
