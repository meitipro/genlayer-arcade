// GET /api/daily/[game]/entry?round&player: the contract's entry view, plus the
// relayed tx hash when this hub sent it (so a reload resumes polling).
import { NextResponse } from "next/server";
import { chainBusy, doneKey, getEntry, txKey } from "@/lib/daily";
import { NAME_RE } from "@/lib/player";
import { redis } from "@/lib/redis";
import { gameOr404, RID_RE } from "@/lib/route-helpers";

export async function GET(req: Request, ctx: { params: Promise<{ game: string }> }) {
  const g = gameOr404((await ctx.params).game);
  if (g instanceof NextResponse) return g;
  const u = new URL(req.url);
  const rid = u.searchParams.get("round") ?? "";
  const player = u.searchParams.get("player") ?? "";
  if (!RID_RE.test(rid) || !NAME_RE.test(player)) return NextResponse.json({ error: "bad round or player" }, { status: 400 });
  const name = (await redis.get<string>(`name:${player.toLowerCase()}`)) ?? player;
  const sent = await redis.get<string>(doneKey(g, rid, name));
  const hash = sent && sent.startsWith("0x") ? sent : null;
  const since = hash ? await redis.hget<string>(txKey(hash), "createdAt") : null;
  try {
    return NextResponse.json({ entry: await getEntry(g, rid, name), hash, since }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ entry: null, hash, since, error: chainBusy(e) });
  }
}
