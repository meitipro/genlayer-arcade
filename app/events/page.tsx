import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import events from "@/data/events.json";
import { gameBySlug } from "@/lib/games";

export const metadata: Metadata = { title: "Events" };

type Event = { id: string; title: string; game: string; startsAt: string; endsAt: string; roomCode: string; rules: string[] };

const utc = (iso: string) => new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export default function Events() {
  const list = (events as Event[]).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-[28px] font-bold">Events</h1>
        <p className="text-muted">Tournaments with room codes. Times are in UTC.</p>
      </div>
      {list.length === 0 ? (
        <div className="card space-y-2 p-5">
          <p>No event is scheduled yet.</p>
          <p className="text-sm text-muted">
            Tournaments are announced in the GenLayer Discord Games Hub. Each one names an arcade game, a one-hour window and a room code; the best single run in the window counts.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((e) => {
            const g = gameBySlug(e.game);
            return (
              <li key={e.id} className="card space-y-3 p-5" style={{ "--accent": g?.accent ?? "#9B7BFF" } as CSSProperties}>
                <p className="flex items-center gap-2 font-semibold">
                  <span className="dot" />
                  {e.title}
                </p>
                <p className="mono text-sm text-muted">
                  {utc(e.startsAt)} to {utc(e.endsAt).slice(11)}
                </p>
                <p className="mono text-sm">
                  room code <span className="text-accent">{e.roomCode}</span>
                </p>
                <ul className="list-inside list-disc text-sm text-muted">
                  {e.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {g && (
                  <Link href={g.href} className="btn btn-ghost">
                    Play {g.title}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
