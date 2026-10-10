import Link from "next/link";
import type { CSSProperties } from "react";
import type { Game } from "@/lib/games";
import type { AnyRound, BridgeRound, OracleRound, VerdictRound } from "@/lib/onchain";
import { Countdown, nextUtc } from "./Countdown";

export function DailyCard({ game, round, error }: { game: Game; round: AnyRound | null; error?: string }) {
  let line = "next round opens at 00:00 UTC";
  let status = "WAITING";
  let to: string | null = null;
  if (round) {
    if (game.slug === "verdict") {
      const r = round as VerdictRound;
      line = r.challenge;
      status = r.open ? "OPEN" : "CLOSED";
      if (r.open) to = nextUtc(0);
    } else if (game.slug === "bridge") {
      const r = round as BridgeRound;
      line = `${r.start} to ${r.end}`;
      status = r.open ? "OPEN" : "CLOSED";
      if (r.open) to = nextUtc(0);
    } else {
      const r = round as OracleRound;
      line = r.question;
      status = r.state.toUpperCase();
      if (r.state === "open") to = nextUtc(18);
    }
  }
  return (
    <Link href={game.href} style={{ "--accent": game.accent } as CSSProperties} className="card flex flex-col gap-3 p-4 hover:border-accent">
      <div className="flex items-center gap-2">
        <span className="dot" />
        <span className="font-semibold">{game.title}</span>
        {round && <span className="mono ml-auto text-xs text-muted">#{round.id}</span>}
      </div>
      <p className="line-clamp-2 min-h-10 text-sm">{error ? <span className="text-muted">{error}</span> : line}</p>
      <div className="mono mt-auto flex items-center justify-between text-xs">
        <span className="text-accent">{status}</span>
        <span className="text-muted">{to ? <Countdown to={to} prefix={game.slug === "oracle" ? "locks in " : "closes in "} /> : round ? `${round.players} players` : ""}</span>
      </div>
    </Link>
  );
}
