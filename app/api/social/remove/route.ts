// POST /api/social/remove {player, playerSecret, network}: takes a handle off the card.
import { NextResponse } from "next/server";
import { verifyPlayer } from "@/lib/player";
import { removeSocial, type Network } from "@/lib/social";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = await verifyPlayer(b.player, b.playerSecret);
  if (!name) return NextResponse.json({ error: "claim a nickname on this device first" }, { status: 401 });
  const network = b.network === "x" || b.network === "github" ? (b.network as Network) : null;
  if (!network) return NextResponse.json({ error: "network is x or github" }, { status: 400 });
  await removeSocial(name, network);
  return NextResponse.json({ ok: true });
}
