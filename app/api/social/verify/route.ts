// POST /api/social/verify {network: "x"}: looks for the code on the X profile.
import { NextResponse } from "next/server";
import { sessionPlayer } from "@/lib/auth";
import { clientIp, limits } from "@/lib/ratelimit";
import { verifyChallenge, type Network } from "@/lib/social";

export async function POST(req: Request) {
  if (!(await limits.session.limit(clientIp(req))).success) return NextResponse.json({ error: "slow down" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = await sessionPlayer(req);
  if (!name) return NextResponse.json({ error: "sign in with Discord first", gate: "discord" }, { status: 401 });
  const network = b.network === "x" ? (b.network as Network) : null;
  if (!network) return NextResponse.json({ error: "network is x" }, { status: 400 });
  try {
    const r = await verifyChallenge(name, network);
    return r.ok ? NextResponse.json({ profile: r.profile }) : NextResponse.json({ error: r.error }, { status: 409 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e).slice(0, 160) }, { status: 503 });
  }
}
