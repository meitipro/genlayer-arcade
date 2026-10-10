"use client";
// The nickname and its device secret live only in this browser's localStorage.
import { useSyncExternalStore } from "react";

export type LocalPlayer = { name: string; secret: string };
const KEY = "arcade.player";
const listeners = new Set<() => void>();
let cache: LocalPlayer | null | undefined;
let cacheRaw: string | null | undefined;

function read(): LocalPlayer | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cacheRaw && cache !== undefined) return cache;
  cacheRaw = raw;
  try {
    const p = raw ? (JSON.parse(raw) as LocalPlayer) : null;
    cache = p && typeof p.name === "string" && typeof p.secret === "string" ? p : null;
  } catch {
    cache = null;
  }
  return cache;
}

export function savePlayer(p: LocalPlayer | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the player stays signed in for this page only */
    cache = p;
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** undefined while hydrating, null when no nickname is claimed on this device. */
export function usePlayer(): LocalPlayer | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}
