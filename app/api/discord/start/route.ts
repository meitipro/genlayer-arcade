// POST /api/discord/start {player, playerSecret}: begins "Connect Discord" for a
// nickname this device owns. Returns the Discord authorize URL; the one-use
// state ties the callback back to that nickname for ten minutes.
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { authorizeUrl, discordConfigured } from "@/lib/discord";
import { verifyPlayer } from "@/lib/player";
import { clientIp, limits } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  if (!discordConfigured()) return NextResponse.json({ error: "Discord connect is not configured on this site yet" }, { status: 503 });
  if (!(await limits.session.limit(clientIp(req))).success) return NextResponse.json({ error: "slow down" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = await verifyPlayer(b.player, b.playerSecret);
  if (!name) return NextResponse.json({ error: "claim a nickname on this device first" }, { status: 401 });
  const state = randomBytes(18).toString("base64url");
  await redis.set(`discord:state:${state}`, name, { ex: 600 });
  return NextResponse.json({ url: authorizeUrl(new URL(req.url).origin, state) });
}
