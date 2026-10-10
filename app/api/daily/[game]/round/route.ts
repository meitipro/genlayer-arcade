// GET /api/daily/[game]/round[?round=N]: latest (or given) round from the contract, s-maxage=30.
import { NextResponse } from "next/server";
import { addressFor, chainBusy, getRound, latestRoundId } from "@/lib/daily";
import { gameOr404, RID_RE } from "@/lib/route-helpers";

export async function GET(req: Request, ctx: { params: Promise<{ game: string }> }) {
  const g = gameOr404((await ctx.params).game);
  if (g instanceof NextResponse) return g;
  if (!addressFor(g)) return NextResponse.json({ round: null, error: "contract not deployed yet" });
  try {
    const asked = new URL(req.url).searchParams.get("round");
    const rid = asked && RID_RE.test(asked) ? asked : await latestRoundId(g);
    const round = rid ? await getRound(g, rid) : null;
    return NextResponse.json({ round }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (e) {
    return NextResponse.json({ round: null, error: chainBusy(e) }, { status: 503 });
  }
}
