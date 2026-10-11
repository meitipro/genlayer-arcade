// POST /api/community/submit: {title, url} from the signed-in player. The relayer
// sends the link to the GameReview contract, which opens the page itself.
import { NextResponse } from "next/server";
import { submitGame, validateSubmission } from "@/lib/community";
import { sessionPlayer } from "@/lib/auth";
import { clientIp, limits } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const player = await sessionPlayer(req);
  if (!player) return NextResponse.json({ error: "sign in with Discord first", gate: "discord" }, { status: 401 });
  const invalid = validateSubmission(b.title, b.url);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (!(await limits.community.limit(clientIp(req))).success)
    return NextResponse.json({ error: "three submissions per day from one network, try again tomorrow" }, { status: 429 });
  const r = await submitGame(player, String(b.title), String(b.url));
  return "hash" in r ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status });
}
