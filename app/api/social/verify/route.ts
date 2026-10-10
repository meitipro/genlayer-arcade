// POST /api/social/verify {player, playerSecret, network}: looks for the code on the profile.
import { NextResponse } from "next/server";
import { verifyPlayer } from "@/lib/player";
import { clientIp, limits } from "@/lib/ratelimit";
import { verifyChallenge, type Network } from "@/lib/social";

export async function POST(req: Request) {
  if (!(await limits.session.limit(clientIp(req))).success) return NextResponse.json({ error: "slow down" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = await verifyPlayer(b.player, b.playerSecret);
  if (!name) return NextResponse.json({ error: "claim a nickname on this device first" }, { status: 401 });
  const network = b.network === "x" || b.network === "github" ? (b.network as Network) : null;
  if (!network) return NextResponse.json({ error: "network is x or github" }, { status: 400 });
  try {
    const r = await verifyChallenge(name, network);
    return r.ok ? NextResponse.json({ profile: r.profile }) : NextResponse.json({ error: r.error }, { status: 409 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e).slice(0, 160) }, { status: 503 });
  }
}
