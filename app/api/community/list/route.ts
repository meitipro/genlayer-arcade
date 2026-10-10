// GET /api/community/list: every on-chain review, newest first.
import { NextResponse } from "next/server";
import { listReviews } from "@/lib/community";
import { chainBusy } from "@/lib/daily";

export async function GET() {
  try {
    return NextResponse.json({ reviews: await listReviews() }, { headers: { "Cache-Control": "public, s-maxage=30" } });
  } catch (e) {
    return NextResponse.json({ reviews: [], error: chainBusy(e) }, { status: 503 });
  }
}
