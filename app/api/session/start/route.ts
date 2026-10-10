// POST /api/session/start: {game} returns an HMAC token {sid, game, t}. 30/min/IP.
import { NextResponse } from "next/server";
import { discordGate, discordRequired } from "@/lib/discord";
import { eventByCode, stateOf } from "@/lib/events";
import { verifyPlayer } from "@/lib/player";
import { gameBySlug } from "@/lib/games";
import { clientIp, limits } from "@/lib/ratelimit";
import { signSession } from "@/lib/session";

export async function POST(req: Request) {
  if (!(await limits.session.limit(clientIp(req))).success)
    return NextResponse.json({ error: "slow down, try again in a minute" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const game = gameBySlug(String(body?.game ?? ""));
  if (!game?.scoring) return NextResponse.json({ error: "no such arcade game" }, { status: 400 });
  // playing needs a connected Discord once the Discord app is configured
  if (discordRequired()) {
    const name = await verifyPlayer(body?.player, body?.playerSecret);
    if (!name) return NextResponse.json({ error: "claim a nickname on this device first", gate: "nickname" }, { status: 401 });
    const gate = await discordGate(name);
    if (gate) return NextResponse.json({ error: gate, gate: "discord" }, { status: 403 });
  }
  // tournament mode: a room code ties this run to a live event of the same game
  let room: string | undefined;
  if (body?.room) {
    const ev = await eventByCode(String(body.room));
    if (!ev) return NextResponse.json({ error: "no event has that room code" }, { status: 404 });
    if (ev.game !== game.slug) return NextResponse.json({ error: `that room code is for ${ev.game}` }, { status: 400 });
    if (stateOf(ev) !== "live") return NextResponse.json({ error: stateOf(ev) === "upcoming" ? "that event has not started yet" : "that event has ended" }, { status: 409 });
    room = ev.id;
  }
  return NextResponse.json({ token: signSession(game.slug, Date.now(), room), room: room ?? null });
}
