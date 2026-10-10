// POST /api/discord/disconnect {player, playerSecret}: unlinks Discord from this nickname.
import { NextResponse } from "next/server";
import { unlinkDiscord } from "@/lib/discord";
import { verifyPlayer } from "@/lib/player";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = await verifyPlayer(b.player, b.playerSecret);
  if (!name) return NextResponse.json({ error: "claim a nickname on this device first" }, { status: 401 });
  await unlinkDiscord(name);
  return NextResponse.json({ ok: true });
}
