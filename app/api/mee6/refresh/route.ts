// POST /api/mee6/refresh: reads the signed-in player's server level and XP from
// MEE6 and keeps it for the card. Takes no input: it is always the session player.
import { NextResponse } from "next/server";
import { sessionPlayer } from "@/lib/auth";
import { discordCardOf } from "@/lib/discord";
import { refreshMee6 } from "@/lib/mee6";
import { clientIp, limits } from "@/lib/ratelimit";

export const maxDuration = 30;

export async function POST(req: Request) {
  const name = await sessionPlayer(req);
  if (!name) return NextResponse.json({ error: "sign in with Discord first", gate: "discord" }, { status: 401 });
  if (!(await limits.mee6.limit(clientIp(req))).success) return NextResponse.json({ error: "slow down, try again later" }, { status: 429 });
  const card = await discordCardOf(name);
  if (!card?.id) return NextResponse.json({ server: null, read: false });
  const { stats, read } = await refreshMee6(card.id);
  return NextResponse.json({ server: stats, read }, { headers: { "Cache-Control": "no-store" } });
}
