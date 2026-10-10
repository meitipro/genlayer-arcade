"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePlayer } from "@/lib/client/player";

type Row = { rank: number; player: string; score: number };
type Board = { season: string; scope: string; rows: Row[]; you?: Row | null };

export function useBoard(game: string, scope: "season" | "all", size: number, bump = 0) {
  const p = usePlayer();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ game, scope });
      if (p?.name) q.set("player", p.name);
      const r = await fetch(`/api/leaderboard?${q}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setBoard({ ...d, rows: d.rows.slice(0, size) });
      setError("");
    } catch {
      setError("could not load the board");
    }
  }, [game, scope, size, p?.name]);
  useEffect(() => {
    void load();
  }, [load, bump]);
  return { board, error, me: p?.name };
}

export function Leaderboard({ game, scope = "season", size = 10, bump = 0, title }: { game: string; scope?: "season" | "all"; size?: number; bump?: number; title?: string }) {
  const { board, error, me } = useBoard(game, scope, size, bump);
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{title ?? (scope === "all" ? "All-time top" : "Season top 10")}</h3>
        {board && <span className="mono text-xs text-muted">{scope === "all" ? "ALL-TIME" : board.season}</span>}
      </div>
      <BoardTable rows={board?.rows} me={me} you={board?.you} error={error} />
    </div>
  );
}

export function BoardTable({ rows, me, you, error }: { rows?: Row[]; me?: string; you?: Row | null; error?: string }) {
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!rows) return <div className="h-32 animate-pulse rounded-[10px] bg-raised" aria-busy />;
  if (!rows.length) return <p className="text-sm text-muted">No scores yet this season. The first run takes the top spot.</p>;
  const meLower = me?.toLowerCase();
  const inTop = rows.some((r) => r.player.toLowerCase() === meLower);
  return (
    <ol className="space-y-1">
      {rows.map((r) => (
        <BoardRow key={r.player} r={r} mine={r.player.toLowerCase() === meLower} />
      ))}
      {you && !inTop && (
        <>
          <li className="px-2 text-center text-xs text-muted" aria-hidden>
            ...
          </li>
          <BoardRow r={you} mine />
        </>
      )}
    </ol>
  );
}

function BoardRow({ r, mine }: { r: Row; mine: boolean }) {
  return (
    <li className={`flex items-center gap-3 rounded-[10px] px-2 py-1.5 text-sm ${mine ? "bg-raised ring-1 ring-accent" : ""}`}>
      <span className="mono w-7 text-right text-muted">{r.rank}</span>
      <Link href={`/p/${r.player}`} className="min-w-0 flex-1 truncate hover:text-accent">
        {r.player}
      </Link>
      <span className="mono text-accent">{r.score.toLocaleString("en-US")}</span>
    </li>
  );
}
