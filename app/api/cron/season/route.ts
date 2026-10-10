// Tier B: Vercel Cron, Monday 00:05 UTC. Writes last week's top 10 of every
// arcade game to SeasonLedger. Authorized by CRON_SECRET.
import { NextResponse } from "next/server";
import { cronOk, finalizeSeason } from "@/lib/admin";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await finalizeSeason());
  } catch (e) {
    console.error("cron season failed", e);
    return NextResponse.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}
