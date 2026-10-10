// GET /api/leaderboard?game&scope=season|all[&season][&player]: top 50, s-maxage=10.
import { NextResponse } from "next/server";
import { boardFor } from "@/lib/boards";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const res = await boardFor(u.searchParams.get("game") ?? "", u.searchParams.get("scope") ?? "season", u.searchParams.get("season") ?? undefined, u.searchParams.get("player") ?? undefined);
  if (!res) return NextResponse.json({ error: "no such arcade game" }, { status: 400 });
  return NextResponse.json(res, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } });
}
