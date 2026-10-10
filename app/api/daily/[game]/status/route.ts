// GET /api/daily/[game]/status?hash: only hashes in daily:tx; returns status + execution result.
import { NextResponse } from "next/server";
import { chainBusy, statusFor, txKey, type TxRecord } from "@/lib/daily";
import { redis } from "@/lib/redis";
import { gameOr404, HASH_RE } from "@/lib/route-helpers";

export async function GET(req: Request, ctx: { params: Promise<{ game: string }> }) {
  const g = gameOr404((await ctx.params).game);
  if (g instanceof NextResponse) return g;
  const hash = new URL(req.url).searchParams.get("hash") ?? "";
  if (!HASH_RE.test(hash)) return NextResponse.json({ error: "bad hash" }, { status: 400 });
  const rec = await redis.hgetall<TxRecord>(txKey(hash));
  if (!rec || rec.game !== g) return NextResponse.json({ error: "unknown transaction" }, { status: 404 });
  try {
    const view = await statusFor(hash as `0x${string}`, rec);
    return NextResponse.json({ ...view, round: rec.round, player: rec.player }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // a timeout after a hash exists is not a failure: the client keeps polling
    return NextResponse.json({ status: "PENDING", result: "", note: chainBusy(e), round: rec.round, player: rec.player });
  }
}
