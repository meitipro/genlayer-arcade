// GET /api/community/status?hash: only hashes this hub sent.
import { NextResponse } from "next/server";
import { chainBusy } from "@/lib/daily";
import { reviewStatus, reviewTx } from "@/lib/community";
import { HASH_RE } from "@/lib/route-helpers";

export async function GET(req: Request) {
  const hash = new URL(req.url).searchParams.get("hash") ?? "";
  if (!HASH_RE.test(hash)) return NextResponse.json({ error: "bad hash" }, { status: 400 });
  const rec = await reviewTx(hash);
  if (!rec) return NextResponse.json({ error: "unknown transaction" }, { status: 404 });
  try {
    return NextResponse.json({ ...(await reviewStatus(hash as `0x${string}`, rec.url)), url: rec.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ status: "PENDING", result: "", note: chainBusy(e), url: rec.url });
  }
}
