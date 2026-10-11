"use client";
// Who is signed in, for the client. The login itself is an HttpOnly cookie the
// browser cannot read, so this asks the server (/api/me) once and shares the answer.
import { useSyncExternalStore } from "react";

export type LocalPlayer = {
  name: string;
  discord: { username: string; avatar: string | null; isMember: boolean; highestRole: string } | null;
};

let cache: LocalPlayer | null | undefined;
let inflight = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function load() {
  if (inflight) return;
  inflight = true;
  fetch("/api/me", { cache: "no-store" })
    .then(async (r) => {
      cache = r.ok ? ((await r.json()) as LocalPlayer) : null;
    })
    .catch(() => {
      cache = null;
    })
    .finally(() => {
      inflight = false;
      emit();
    });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (cache === undefined) load();
  return () => {
    listeners.delete(fn);
  };
}

/** undefined while loading, null when signed out. */
export function usePlayer(): LocalPlayer | null | undefined {
  return useSyncExternalStore(subscribe, () => cache, () => undefined);
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  cache = null;
  emit();
  window.location.href = "/login";
}

export function loginUrl(next?: string): string {
  const n = next ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  return `/api/discord/login?next=${encodeURIComponent(n)}`;
}

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; gate?: string };
  // the session ended: back to the login page, which comes first
  if (res.status === 401 && data.gate === "discord" && typeof window !== "undefined") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  return { ok: res.ok, status: res.status, data };
}
