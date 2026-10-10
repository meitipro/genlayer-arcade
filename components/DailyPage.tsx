// Server shell for /daily/verdict, /daily/bridge and /daily/oracle: the round,
// the play surface, the round board and past rounds.
import Link from "next/link";
import type { CSSProperties } from "react";
import { getBoard, today } from "@/lib/daily";
import { addressUrl } from "@/lib/explorer";
import { gameBySlug } from "@/lib/games";
import { contractAddress } from "@/lib/genlayer";
import { ONCHAIN, type OnchainGame } from "@/lib/onchain";
import { DailyPlay } from "./DailyPlay";
import { RoundBoard } from "./RoundBoard";

export async function DailyPage({ game }: { game: OnchainGame }) {
  const g = gameBySlug(game)!;
  const { round, error } = await today(game);
  let rows: unknown[] = [];
  try {
    rows = round ? await getBoard(game, round.id) : [];
  } catch {
    rows = [];
  }
  const address = contractAddress(ONCHAIN[game].env);
  const past = round ? Array.from({ length: Math.min(7, Number(round.id) - 1) }, (_, i) => String(Number(round.id) - 1 - i)) : [];
  return (
    <div style={{ "--accent": g.accent } as CSSProperties} className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <Link href="/daily" className="text-sm text-muted hover:text-text">
          Daily
        </Link>
        <h1 className="flex items-center gap-2 text-[28px] font-bold">
          <span className="dot h-3 w-3" />
          {g.title}
        </h1>
        <p className="max-w-2xl text-muted">{g.blurb}</p>
        <p className="text-sm">
          <span className="text-muted">Why GenLayer:</span> {g.idea}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {error && <p className="card p-4 text-sm text-danger">{error}</p>}
          <DailyPlay game={game} round={round as never} title={g.title} />
          <aside className="card border-l-4 p-4" style={{ borderLeftColor: g.accent }}>
            <p className="mono text-xs uppercase text-muted">how it is settled</p>
            <p className="mt-2 text-sm leading-relaxed">{g.concept}</p>
          </aside>
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">{round ? `Round ${round.id} board` : "Round board"}</h2>
            <RoundBoard game={game} rows={rows} round={round as never} />
          </div>
          {past.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 font-semibold">Past rounds</h2>
              <ul className="flex flex-wrap gap-2">
                {past.map((r) => (
                  <li key={r}>
                    <Link href={`/daily/${game}/${r}`} className="mono pill hover:border-accent">
                      #{r}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {address && (
            <a href={addressUrl(address)} target="_blank" rel="noreferrer" className="mono block break-all text-xs text-muted hover:text-text">
              contract {address}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
