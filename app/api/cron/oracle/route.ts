// Tier B: Vercel Cron at 18:00 UTC. Locks today's Oracle round, then resolves
// it from the live source. Authorized by CRON_SECRET.
import { NextResponse } from "next/server";
import { cronOk, oracleDeadline } from "@/lib/admin";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ sent: await oracleDeadline() });
  } catch (e) {
    console.error("cron oracle failed", e);
    return NextResponse.json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}
