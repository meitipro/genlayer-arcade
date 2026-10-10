import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { RoomCodeForm } from "@/components/RoomCodeForm";
import { listEvents, stateOf } from "@/lib/events";
import { gameBySlug } from "@/lib/games";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events" };

const utc = (iso: string) => new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export default async function Events() {
  const list = await listEvents();
  const order = { live: 0, upcoming: 1, ended: 2 } as const;
  const sorted = [...list].sort((a, b) => order[stateOf(a)] - order[stateOf(b)] || a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-[28px] font-bold">Events</h1>
        <p className="text-muted">
          Tournaments with room codes. Each event names one arcade game and a time window in UTC. Runs started with the room code while the event is live also land on that event&apos;s own board.
        </p>
      </div>
      <RoomCodeForm />
      {sorted.length === 0 ? (
        <div className="card space-y-2 p-5">
          <p>No event is scheduled yet.</p>
          <p className="text-sm text-muted">Tournaments are announced in the GenLayer Discord Games Hub, with a room code to enter here.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {sorted.map((e) => {
            const g = gameBySlug(e.game);
            const st = stateOf(e);
            return (
              <li key={e.id} className="card space-y-3 p-5" style={{ "--accent": g?.accent ?? "#9B7BFF" } as CSSProperties}>
                <div className="flex items-center gap-2">
                  <span className="dot" />
                  <Link href={`/events/${e.id}`} className="font-semibold hover:text-accent">
                    {e.title}
                  </Link>
                  <span className={`mono ml-auto text-xs uppercase ${st === "live" ? "text-accent" : "text-muted"}`}>{st}</span>
                </div>
                <p className="mono text-sm text-muted">
                  {utc(e.startsAt)} to {utc(e.endsAt)}
                </p>
                <p className="mono text-sm">
                  {g?.title} · room code <span className="text-accent">{e.roomCode}</span>
                </p>
                {e.rules.length > 0 && (
                  <ul className="list-inside list-disc text-sm text-muted">
                    {e.rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                <Link href={`/events/${e.id}`} className="btn btn-ghost">
                  {st === "live" ? "Board and join" : "Event board"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
