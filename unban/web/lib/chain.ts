/**
 * Reading the contract. Used by server pages and client components alike;
 * reads need no wallet and no key. Studio drops connections in bursts and
 * genlayer-js retries nothing, so a read is retried on a transient failure
 * (a write never is: see lib/write.ts).
 */

import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

import { CHAIN_ID, CONTRACT, IS_LIVE, RPC } from "./config";
import type { Appeal, AppealRow, Court } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** studioDevnet with the RPC pinned to studio-next.genlayer.com, never the SDK's default. */
export const chain: any = { ...studioDevnet, id: CHAIN_ID, rpcUrls: { default: { http: [RPC] } } };

let reader: any = null;
function client(): any {
  if (!reader) reader = createClient({ chain });
  return reader;
}

export function isTransient(error: unknown): boolean {
  const text = String((error as Error)?.message ?? error);
  return /fetch failed|ECONNRESET|socket|network|timed out|timeout|Server busy|-32006|-32029|rate limit|429|502|503|504/i.test(text);
}

export async function retried<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let wait = 800;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts || !isTransient(error)) throw error;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(Math.round(wait * 1.8), 8000);
    }
  }
}

export async function readJson<T>(method: string, args: (number | string)[]): Promise<T> {
  if (!IS_LIVE) throw new Error("not_deployed");
  const raw = await retried(() => client().readContract({ address: CONTRACT, functionName: method, args }));
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
}

export const getCourts = () => readJson<{ court_count: number; courts: Court[] }>("get_court", [0]);
export const getCourt = (id: number) => readJson<Court>("get_court", [id]);
export const getAppeal = (id: number) => readJson<Appeal>("get_appeal", [id]);
export const listAppeals = (courtId: number, status: string, offset = 0, limit = 20) =>
  readJson<AppealRow[]>("list_appeals", [courtId, status, offset, limit]);

/** A page's read, as data or as the reason it could not be had. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; reason: "not_deployed" | "unreachable" | "missing"; detail: string };

export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    const text = String((error as Error)?.message ?? error);
    if (text === "not_deployed") return { ok: false, reason: "not_deployed", detail: text };
    if (/unknown (court|appeal)|execution failed/i.test(text)) return { ok: false, reason: "missing", detail: text };
    return { ok: false, reason: "unreachable", detail: text.slice(0, 200) };
  }
}
