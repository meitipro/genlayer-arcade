// POST /api/social/start {player, playerSecret, network, handle}: returns the code to put in the bio.
import { NextResponse } from "next/server";
import { verifyPlayer } from "@/lib/player";
import { clientIp, limits } from "@/lib/ratelimit";
import { cleanHandle, startChallenge, xConfigured, type Network } from "@/lib/social";

export async function POST(req: Request) {
  if (!(await limits.session.limit(clientIp(req))).success) return NextResponse.json({ error: "slow down" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = await verifyPlayer(b.player, b.playerSecret);
  if (!name) return NextResponse.json({ error: "claim a nickname on this device first" }, { status: 401 });
  const network = b.network === "x" || b.network === "github" ? (b.network as Network) : null;
  if (!network) return NextResponse.json({ error: "network is x or github" }, { status: 400 });
  if (network === "x" && !xConfigured()) return NextResponse.json({ error: "X verification is not configured on this site yet" }, { status: 503 });
  const handle = cleanHandle(network, b.handle);
  if (!handle) return NextResponse.json({ error: "that does not look like a handle" }, { status: 400 });
  const code = await startChallenge(name, network, handle);
  return NextResponse.json({
    code,
    handle,
    instructions: network === "x" ? `Add ${code} to the bio or location of @${handle}, then press Verify.` : `Add ${code} to the bio of github.com/${handle}, then press Verify.`,
  });
}
