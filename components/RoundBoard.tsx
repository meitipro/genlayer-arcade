import Link from "next/link";
import type { BridgeEntry, OnchainGame, OracleResult, OracleRound, VerdictEntry } from "@/lib/onchain";

export function RoundBoard({ game, rows, round }: { game: OnchainGame; rows: unknown[]; round: { id: string } | null }) {
  if (!round) return <p className="text-sm text-muted">No round yet.</p>;
  if (game === "oracle") {
    const r = round as OracleRound;
    if (r.state !== "resolved")
      return <p className="text-sm text-muted">{r.players} guesses locked in. The ranking appears when the contract resolves the round.</p>;
  }
  if (!rows.length) return <p className="text-sm text-muted">No entries yet. Be the first.</p>;
  return (
    <ol className="space-y-2">
      {rows.map((row, i) => {
        if (game === "verdict") {
          const e = row as VerdictEntry;
          return (
            <li key={e.player} className="space-y-1 rounded-[10px] bg-raised/50 p-2 text-sm">
              <div className="flex gap-3">
                <span className="mono w-6 text-muted">{i + 1}</span>
                <Link href={`/p/${e.player}`} className="flex-1 truncate hover:text-accent">
                  {e.player}
                </Link>
                <span className="mono text-accent">{e.score}/10</span>
              </div>
              <p className="pl-9 text-xs text-muted">{e.entry}</p>
            </li>
          );
        }
        if (game === "bridge") {
          const e = row as BridgeEntry;
          return (
            <li key={e.player} className="space-y-1 rounded-[10px] bg-raised/50 p-2 text-sm">
              <div className="flex gap-3">
                <span className="mono w-6 text-muted">{i + 1}</span>
                <Link href={`/p/${e.player}`} className="flex-1 truncate hover:text-accent">
                  {e.player}
                </Link>
                <span className={`mono ${e.valid ? "text-accent" : "text-danger"}`}>{e.valid ? e.score : "invalid"}</span>
              </div>
              <p className="mono pl-9 text-xs text-muted">
                {e.chain.map((w, k) => (
                  <span key={k}>
                    {w}
                    {k < e.chain.length - 1 && <span className={e.links[k] ? "text-accent" : "text-danger"}> {e.links[k] ? "-" : "x"} </span>}
                  </span>
                ))}
              </p>
            </li>
          );
        }
        const e = row as OracleResult;
        return (
          <li key={e.player} className="flex gap-3 text-sm">
            <span className="mono w-6 text-muted">{i + 1}</span>
            <Link href={`/p/${e.player}`} className="flex-1 truncate hover:text-accent">
              {e.player}
            </Link>
            <span className="mono">{e.guess}</span>
            <span className="mono w-16 text-right text-accent">off {e.off}</span>
          </li>
        );
      })}
    </ol>
  );
}
