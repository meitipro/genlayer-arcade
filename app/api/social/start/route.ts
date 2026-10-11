// POST /api/social/start {network: "x", handle}: returns the code to put in the X bio or location.
import { NextResponse } from "next/server";
import { sessionPlayer } from "@/lib/auth";
import { clientIp, limits } from "@/lib/ratelimit";
import { cleanHandle, startChallenge, xConfigured, type Network } from "@/lib/social";

export async function POST(req: Request) {
  if (!(await limits.session.limit(clientIp(req))).success) return NextResponse.json({ error: "slow down" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = await sessionPlayer(req);
  if (!name) return NextResponse.json({ error: "sign in with Discord first", gate: "discord" }, { status: 401 });
  const network = b.network === "x" ? (b.network as Network) : null;
  if (!network) return NextResponse.json({ error: "network is x" }, { status: 400 });
  if (network === "x" && !xConfigured()) return NextResponse.json({ error: "X verification is not configured on this site yet" }, { status: 503 });
  const handle = cleanHandle(network, b.handle);
  if (!handle) return NextResponse.json({ error: "that does not look like a handle" }, { status: 400 });
  const code = await startChallenge(name, network, handle);
  return NextResponse.json({
    code,
    handle,
    instructions: `Add ${code} to the bio or location of @${handle}, then press Verify.`,
  });
}
