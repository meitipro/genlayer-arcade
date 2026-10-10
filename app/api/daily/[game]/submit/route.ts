// POST /api/daily/[game]/submit: player secret, ONCHAIN[game].validate,
// 3/hour/IP, SET daily:done NX, relayWrite, returns {hash} at once.
import { NextResponse } from "next/server";
import { addressFor, chainBusy, doneKey, getRound, latestRoundId, rememberTx } from "@/lib/daily";
import { relayWrite } from "@/lib/genlayer";
import { ONCHAIN, roundIsOpen } from "@/lib/onchain";
import { verifyPlayer } from "@/lib/player";
import { clientIp, limits } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";
import { gameOr404 } from "@/lib/route-helpers";

export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ game: string }> }) {
  const g = gameOr404((await ctx.params).game);
  if (g instanceof NextResponse) return g;
  const cfg = ONCHAIN[g];
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const player = await verifyPlayer(body.player, body.playerSecret);
  if (!player) return NextResponse.json({ error: "claim a nickname on this device first" }, { status: 401 });
  const invalid = cfg.validate(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const address = addressFor(g);
  if (!address) return NextResponse.json({ error: "this game's contract is not deployed yet" }, { status: 503 });

  let rid: string | null;
  try {
    rid = await latestRoundId(g);
    const round = rid ? await getRound(g, rid) : null;
    if (!rid || !roundIsOpen(g, round))
      return NextResponse.json({ error: "no open round right now, the next one opens at 00:00 UTC" }, { status: 409 });
    if (body.round !== undefined && String(body.round) !== rid)
      return NextResponse.json({ error: "that round has closed, reload for the current round" }, { status: 409 });
  } catch (e) {
    return NextResponse.json({ error: `not sent: ${chainBusy(e)}` }, { status: 503 });
  }

  if (!(await limits.daily.limit(clientIp(req))).success)
    return NextResponse.json({ error: "three daily submissions per hour from one network, try again later" }, { status: 429 });

  // one entry per nickname per round, claimed before the relayer spends anything
  if (!(await redis.set(doneKey(g, rid, player), "pending", { nx: true, ex: 7 * 86400 })))
    return NextResponse.json({ error: "you already played this round" }, { status: 409 });

  try {
    const hash = await relayWrite(address, cfg.submitFn, cfg.toArgs(rid, player, body));
    await redis.set(doneKey(g, rid, player), hash, { ex: 7 * 86400 });
    await rememberTx(hash, { game: g, round: rid, player, createdAt: new Date().toISOString() });
    return NextResponse.json({ hash, round: rid });
  } catch (e) {
    await redis.del(doneKey(g, rid, player));
    console.error("relayWrite failed", g, rid, String((e as Error)?.message ?? e).slice(0, 300));
    return NextResponse.json({ error: "not sent, try again in a minute" }, { status: 503 });
  }
}
