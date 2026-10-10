// GET /api/card/[name]: the public card. No secret is on a card.
import { NextResponse } from "next/server";
import { cardFor } from "@/lib/card";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const card = await cardFor(decodeURIComponent((await ctx.params).name));
  return card ? NextResponse.json(card, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "no such player" }, { status: 404 });
}
