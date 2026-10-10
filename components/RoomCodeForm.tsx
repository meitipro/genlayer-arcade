"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RoomCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card flex flex-wrap items-end gap-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        const r = await fetch(`/api/events?code=${encodeURIComponent(code.trim())}`).then((x) => x.json()).catch(() => ({}));
        setBusy(false);
        if (!r.event) return setError(r.error ?? "no event has that room code");
        router.push(r.event.state === "live" ? `/play/${r.event.game}?room=${encodeURIComponent(r.event.roomCode)}` : `/events/${r.event.id}`);
      }}
    >
      <label className="min-w-48 flex-1">
        <span className="text-sm text-muted">Have a room code?</span>
        <input className="field mono uppercase" value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 16))} placeholder="ROOM-CODE" />
      </label>
      <button className="btn btn-primary" disabled={busy || code.length < 3}>
        {busy ? "Looking" : "Join"}
      </button>
      {error && (
        <p className="w-full text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
