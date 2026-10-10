// POST /api/session/start: {game} returns an HMAC token {sid, game, t}. 30/min/IP.
import { NextResponse } from "next/server";
import { gameBySlug } from "@/lib/games";
import { clientIp, limits } from "@/lib/ratelimit";
import { signSession } from "@/lib/session";

export async function POST(req: Request) {
  if (!(await limits.session.limit(clientIp(req))).success)
    return NextResponse.json({ error: "slow down, try again in a minute" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const game = gameBySlug(String(body?.game ?? ""));
  if (!game?.scoring) return NextResponse.json({ error: "no such arcade game" }, { status: 400 });
  return NextResponse.json({ token: signSession(game.slug) });
}
