import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { AccentStyle } from "@/components/AccentStyle";
import { Countdown } from "@/components/Countdown";
import { eventBoardKey, eventById, stateOf } from "@/lib/events";
import { gameBySlug } from "@/lib/games";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const e = await eventById((await params).id);
  return e ? { title: e.title } : {};
}

const utc = (iso: string) => new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const e = await eventById((await params).id);
  if (!e) notFound();
  const g = gameBySlug(e.game)!;
  const st = stateOf(e);
  const rows = await redis.ztop(eventBoardKey(e.id), 50);
  return (
    <div style={{ "--accent": g.accent } as CSSProperties} className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <AccentStyle accent={g.accent} />
      <Link href="/events" className="text-sm text-muted hover:text-text">
        Events
      </Link>
      <div className="space-y-2">
        <h1 className="text-[28px] font-bold">{e.title}</h1>
        <p className="mono text-sm text-muted">
          {g.title} · {utc(e.startsAt)} to {utc(e.endsAt)}
        </p>
        <p className="mono text-sm">
          <span className={st === "live" ? "text-accent" : "text-muted"}>{st.toUpperCase()}</span>
          {st === "upcoming" && <Countdown to={e.startsAt} prefix=" · starts in " done="starting" />}
          {st === "live" && <Countdown to={e.endsAt} prefix=" · ends in " done="ended" />}
          {" · "}room code <span className="text-accent">{e.roomCode}</span>
        </p>
      </div>
      {st === "live" && (
        <Link href={`${g.href}?room=${encodeURIComponent(e.roomCode)}`} className="btn btn-primary">
          Play in this room
        </Link>
      )}
      {e.rules.length > 0 && (
        <ul className="card list-inside list-disc space-y-1 p-4 text-sm text-muted">
          {e.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <div className="card p-4">
        <h2 className="mb-3 font-semibold">Event board</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{st === "upcoming" ? "The board opens when the event starts." : "No runs in this room yet."}</p>
        ) : (
          <ol className="space-y-1">
            {rows.map((r, i) => (
              <li key={r.member} className="flex gap-3 text-sm">
                <span className="mono w-7 text-right text-muted">{i + 1}</span>
                <Link href={`/p/${r.member}`} className="flex-1 truncate hover:text-accent">
                  {r.member}
                </Link>
                <span className="mono text-accent">{r.score.toLocaleString("en-US")}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
