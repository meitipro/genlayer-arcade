// POST /api/community/submit: {player, playerSecret, title, url}. The relayer
// sends the link to the GameReview contract, which opens the page itself.
import { NextResponse } from "next/server";
import { submitGame, validateSubmission } from "@/lib/community";
import { discordGate } from "@/lib/discord";
import { verifyPlayer } from "@/lib/player";
import { clientIp, limits } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const player = await verifyPlayer(b.player, b.playerSecret);
  if (!player) return NextResponse.json({ error: "claim a nickname on this device first" }, { status: 401 });
  const gate = await discordGate(player);
  if (gate) return NextResponse.json({ error: gate, gate: "discord" }, { status: 403 });
  const invalid = validateSubmission(b.title, b.url);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (!(await limits.community.limit(clientIp(req))).success)
    return NextResponse.json({ error: "three submissions per day from one network, try again tomorrow" }, { status: 429 });
  const r = await submitGame(player, String(b.title), String(b.url));
  return "hash" in r ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status });
}
