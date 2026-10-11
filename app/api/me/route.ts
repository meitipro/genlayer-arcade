// GET /api/me: the signed-in player, for the client. 401 when there is no session.
import { NextResponse } from "next/server";
import { sessionPlayer } from "@/lib/auth";
import { discordCardOf } from "@/lib/discord";

export async function GET(req: Request) {
  const name = await sessionPlayer(req);
  if (!name) return NextResponse.json({ error: "sign in with Discord first", gate: "discord" }, { status: 401 });
  const d = await discordCardOf(name);
  return NextResponse.json(
    { name, discord: d ? { username: d.username, avatar: d.avatar, isMember: d.isMember, highestRole: d.highestRole } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
