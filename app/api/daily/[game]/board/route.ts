// GET /api/daily/[game]/board?round: the round board view (Oracle: ranked results).
import { NextResponse } from "next/server";
import { awardOracle, chainBusy, getBoard, getRound, latestRoundId } from "@/lib/daily";
import type { OracleResult, OracleRound } from "@/lib/onchain";
import { gameOr404, RID_RE } from "@/lib/route-helpers";

export async function GET(req: Request, ctx: { params: Promise<{ game: string }> }) {
  const g = gameOr404((await ctx.params).game);
  if (g instanceof NextResponse) return g;
  try {
    const asked = new URL(req.url).searchParams.get("round");
    const rid = asked && RID_RE.test(asked) ? asked : await latestRoundId(g);
    if (!rid) return NextResponse.json({ round: null, rows: [] });
    const rows = await getBoard(g, rid);
    if (g === "oracle") await awardOracle(rid, (await getRound(g, rid)) as OracleRound | null, rows as OracleResult[]);
    return NextResponse.json({ round: rid, rows }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } });
  } catch (e) {
    return NextResponse.json({ rows: [], error: chainBusy(e) }, { status: 503 });
  }
}
