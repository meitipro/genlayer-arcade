// Past rounds, shareable: /daily/[game]/[round]
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { AccentStyle } from "@/components/AccentStyle";
import { RoundBoard } from "@/components/RoundBoard";
import { chainBusy, getBoard, getRound } from "@/lib/daily";
import { gameBySlug } from "@/lib/games";
import { isOnchain, type BridgeRound, type OracleRound, type VerdictRound } from "@/lib/onchain";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ game: string; round: string }> }): Promise<Metadata> {
  const { game, round } = await params;
  const g = gameBySlug(game);
  return g ? { title: `${g.title} #${round}` } : {};
}

export default async function PastRound({ params }: { params: Promise<{ game: string; round: string }> }) {
  const { game, round: rid } = await params;
  if (!isOnchain(game) || !/^[1-9][0-9]{0,8}$/.test(rid)) notFound();
  const g = gameBySlug(game)!;
  let round = null;
  let rows: unknown[] = [];
  let error = "";
  try {
    round = await getRound(game, rid);
    rows = round ? await getBoard(game, rid) : [];
  } catch (e) {
    error = chainBusy(e);
  }
  if (!round && !error) notFound();
  let heading = "";
  if (round && game === "verdict") heading = (round as VerdictRound).challenge;
  if (round && game === "bridge") heading = `${(round as BridgeRound).start} to ${(round as BridgeRound).end}`;
  if (round && game === "oracle") {
    const r = round as OracleRound;
    heading = r.question + (r.state === "resolved" && r.answer !== null ? `  Answer: ${r.answer} ${r.unit}` : "");
  }
  return (
    <div style={{ "--accent": g.accent } as CSSProperties} className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <AccentStyle accent={g.accent} />
      <Link href={g.href} className="text-sm text-muted hover:text-text">
        {g.title}
      </Link>
      <h1 className="text-[28px] font-bold">
        {g.title} <span className="mono text-accent">#{rid}</span>
      </h1>
      {error && <p className="card p-4 text-sm text-danger">{error}</p>}
      {round && (
        <>
          <p className="text-lg">{heading}</p>
          <p className="mono text-xs uppercase text-muted">
            {round.players} players ·{" "}
            {game === "oracle" ? (round as OracleRound).state : (round as VerdictRound).open ? "open" : "closed"}
          </p>
          <div className="card p-4">
            <RoundBoard game={game} rows={rows} round={round} />
          </div>
        </>
      )}
    </div>
  );
}
