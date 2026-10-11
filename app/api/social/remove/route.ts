// POST /api/social/remove {network: "x"}: takes the X handle off the card.
import { NextResponse } from "next/server";
import { sessionPlayer } from "@/lib/auth";
import { removeSocial, type Network } from "@/lib/social";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = await sessionPlayer(req);
  if (!name) return NextResponse.json({ error: "sign in with Discord first", gate: "discord" }, { status: 401 });
  const network = b.network === "x" ? (b.network as Network) : null;
  if (!network) return NextResponse.json({ error: "network is x" }, { status: 400 });
  await removeSocial(name, network);
  return NextResponse.json({ ok: true });
}
