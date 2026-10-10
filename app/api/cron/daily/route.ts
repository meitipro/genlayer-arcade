// Tier B: Vercel Cron at 00:00 UTC. Closes yesterday's Verdict and Bridge,
// opens today's three rounds. Authorized by CRON_SECRET.
import { NextResponse } from "next/server";
import { cronOk, dailyRollover } from "@/lib/admin";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ sent: await dailyRollover() });
  } catch (e) {
    console.error("cron daily failed", e);
    return NextResponse.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}
