// GET /api/events[?code=ROOM]: the event list, or the event a room code belongs to.
import { NextResponse } from "next/server";
import { eventByCode, listEvents, stateOf } from "@/lib/events";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (code !== null) {
    const e = await eventByCode(code);
    return e ? NextResponse.json({ event: { ...e, state: stateOf(e) } }) : NextResponse.json({ error: "no event has that room code" }, { status: 404 });
  }
  const events = await listEvents();
  return NextResponse.json({ events: events.map((e) => ({ ...e, state: stateOf(e) })) }, { headers: { "Cache-Control": "public, s-maxage=15" } });
}
