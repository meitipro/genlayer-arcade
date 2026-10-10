// lib/events.ts: tournaments with room codes (section 20, "Tournament mode:
// event code scopes a temporary board, same pipeline"). Events come from
// data/events.json and from the admin panel (kept in Redis, no redeploy).
// A run started with an event's room code while the event is live also lands
// on that event's own board, lb:event:{id}.
import "server-only";
import seed from "@/data/events.json";
import { gameBySlug } from "./games";
import { redis } from "./redis";

export type ArcadeEvent = {
  id: string;
  title: string;
  game: string;
  startsAt: string;
  endsAt: string;
  roomCode: string;
  rules: string[];
};

export type EventState = "upcoming" | "live" | "ended";

/** Scores from a run that started inside the window are accepted this long after it ends. */
export const GRACE_MS = 5 * 60 * 1000;
const ID_RE = /^[a-z0-9-]{3,40}$/;
const CODE_RE = /^[A-Z0-9-]{3,16}$/;

export function stateOf(e: ArcadeEvent, now = Date.now()): EventState {
  if (now < Date.parse(e.startsAt)) return "upcoming";
  if (now <= Date.parse(e.endsAt)) return "live";
  return "ended";
}

export async function listEvents(): Promise<ArcadeEvent[]> {
  const stored = (await redis.hgetall<Record<string, string>>("events")) ?? {};
  const dynamic = Object.values(stored).map((v) => (typeof v === "string" ? JSON.parse(v) : v) as ArcadeEvent);
  const all = [...(seed as ArcadeEvent[]), ...dynamic];
  const byId = new Map(all.map((e) => [e.id, e]));
  return [...byId.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function eventById(id: string): Promise<ArcadeEvent | null> {
  return (await listEvents()).find((e) => e.id === id) ?? null;
}

export async function eventByCode(code: string): Promise<ArcadeEvent | null> {
  const c = String(code ?? "").trim().toUpperCase();
  return (await listEvents()).find((e) => e.roomCode === c) ?? null;
}

export type EventInput = { id?: string; title?: string; game?: string; startsAt?: string; endsAt?: string; roomCode?: string; rules?: string | string[] };

export function validateEvent(b: EventInput): { ok: true; event: ArcadeEvent } | { ok: false; error: string } {
  const title = String(b.title ?? "").trim();
  const game = String(b.game ?? "");
  const roomCode = String(b.roomCode ?? "").trim().toUpperCase();
  const start = Date.parse(String(b.startsAt ?? ""));
  const end = Date.parse(String(b.endsAt ?? ""));
  const id =
    String(b.id ?? "").trim() ||
    `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28)}-${roomCode.toLowerCase()}`.slice(0, 40);
  const rules = (Array.isArray(b.rules) ? b.rules : String(b.rules ?? "").split("\n")).map((r) => r.trim()).filter(Boolean).slice(0, 6);
  if (title.length < 3 || title.length > 80) return { ok: false, error: "title must be 3 to 80 characters" };
  if (!gameBySlug(game)?.scoring) return { ok: false, error: "pick an arcade game" };
  if (!CODE_RE.test(roomCode)) return { ok: false, error: "room code: 3 to 16 letters, digits or dashes" };
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { ok: false, error: "the end must be after the start" };
  if (end - start > 14 * 86400000) return { ok: false, error: "an event lasts at most 14 days" };
  if (!ID_RE.test(id)) return { ok: false, error: "bad event id" };
  return { ok: true, event: { id, title, game, roomCode, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), rules } };
}

export async function saveEvent(e: ArcadeEvent): Promise<{ ok: boolean; error?: string }> {
  const clash = (await listEvents()).find((x) => x.roomCode === e.roomCode && x.id !== e.id);
  if (clash) return { ok: false, error: `room code already used by ${clash.title}` };
  await redis.hset("events", { [e.id]: JSON.stringify(e) });
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<boolean> {
  const stored = (await redis.hgetall<Record<string, string>>("events")) ?? {};
  if (!(id in stored)) return false;
  const rest = Object.fromEntries(Object.entries(stored).filter(([k]) => k !== id));
  await redis.del("events");
  if (Object.keys(rest).length) await redis.hset("events", rest);
  return true;
}

export const eventBoardKey = (id: string) => `lb:event:${id}`;
