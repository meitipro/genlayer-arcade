"use client";
// Admin panels for tournament events and community game reviews.
import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/client/player";

type Call = (action: string, body?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
type Ev = { id: string; title: string; game: string; startsAt: string; endsAt: string; roomCode: string; state?: string };
type Review = { id: string; title: string; url: string; label: string; listed: boolean; rechecked: boolean; delisted?: string };

const ARCADE = ["validator-run", "consensus-stack", "leader-rotation", "equivalence", "chain-snake", "appeal-breaker"];

export function useAdminCall(token: string): [Call, string, boolean] {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const call = useCallback<Call>(
    async (action, body = {}) => {
      setBusy(true);
      setMsg("");
      const r = await postJson<Record<string, unknown>>(`/api/admin/${action}`, body, { "x-admin-token": token });
      setBusy(false);
      if (!r.ok) {
        setMsg(`${action}: ${r.data.error ?? r.status}`);
        return null;
      }
      setMsg(`${action}: done`);
      return r.data;
    },
    [token],
  );
  return [call, msg, busy];
}

/** "2026-10-17T18:00" in UTC from a datetime-local value read as UTC. */
const asUtc = (local: string) => (local ? `${local}:00Z` : "");

export function EventsPanel({ token }: { token: string }) {
  const [call, msg, busy] = useAdminCall(token);
  const [events, setEvents] = useState<Ev[]>([]);
  const [f, setF] = useState({ title: "", game: ARCADE[0], startsAt: "", endsAt: "", roomCode: "", rules: "Best single run in the window counts" });
  const load = useCallback(async () => {
    const d = await fetch("/api/events", { cache: "no-store" }).then((x) => x.json()).catch(() => ({}));
    setEvents(d.events ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">Events (tournament mode)</h2>
      <p className="text-sm text-muted">Times are UTC. Runs started with the room code while the event is live also land on the event board.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="field text-sm" placeholder="title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select className="field text-sm" value={f.game} onChange={(e) => setF({ ...f, game: e.target.value })} aria-label="Game">
          {ARCADE.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <label className="text-xs text-muted">
          starts (UTC)
          <input className="field text-sm" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
        </label>
        <label className="text-xs text-muted">
          ends (UTC)
          <input className="field text-sm" type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
        </label>
        <input className="field mono text-sm uppercase" placeholder="ROOM-CODE" value={f.roomCode} onChange={(e) => setF({ ...f, roomCode: e.target.value.toUpperCase() })} />
        <textarea className="field text-sm" placeholder="rules, one per line" value={f.rules} onChange={(e) => setF({ ...f, rules: e.target.value })} />
      </div>
      <button
        className="btn btn-primary w-full"
        disabled={busy || !token}
        onClick={async () => {
          if (await call("create-event", { ...f, startsAt: asUtc(f.startsAt), endsAt: asUtc(f.endsAt) })) void load();
        }}
      >
        Create event
      </button>
      {msg && <p className="text-sm">{msg}</p>}
      <ul className="space-y-1 text-sm">
        {events.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2">
            <span className="mono text-xs text-muted">{e.state}</span>
            <span>{e.title}</span>
            <span className="mono text-xs text-accent">{e.roomCode}</span>
            <button
              className="mono ml-auto text-xs text-muted hover:text-danger"
              onClick={async () => {
                if (confirm(`Delete ${e.title}?`) && (await call("delete-event", { id: e.id }))) void load();
              }}
            >
              DELETE
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReviewsPanel({ token }: { token: string }) {
  const [call, msg, busy] = useAdminCall(token);
  const [reviews, setReviews] = useState<Review[]>([]);
  const load = useCallback(async () => {
    const d = await fetch("/api/community/list", { cache: "no-store" }).then((x) => x.json()).catch(() => ({}));
    setReviews(d.reviews ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">Community reviews</h2>
      <p className="text-sm text-muted">An UNREACHABLE review can be rechecked once. A listed game can be delisted with a reason, which is kept on-chain.</p>
      {msg && <p className="text-sm">{msg}</p>}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted">No submissions yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <span className="mono text-xs text-muted">#{r.id}</span>
              <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                {r.title}
              </a>
              <span className="mono text-xs">{r.delisted ? "DELISTED" : r.label}</span>
              {r.label === "UNREACHABLE" && !r.rechecked && (
                <button className="mono ml-auto text-xs text-accent" disabled={busy} onClick={() => call("review-recheck", { id: r.id })}>
                  RECHECK
                </button>
              )}
              {r.listed && (
                <button
                  className="mono ml-auto text-xs text-muted hover:text-danger"
                  disabled={busy}
                  onClick={() => {
                    const reason = prompt("Reason for delisting (kept on-chain)");
                    if (reason && reason.trim().length >= 3) void call("review-delist", { id: r.id, reason: reason.trim() });
                  }}
                >
                  DELIST
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
