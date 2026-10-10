// POST /api/player/claim: name ^[a-zA-Z0-9_]{3,20}$, unique, returns a 32-byte
// secret once, stores sha256(secret + pepper). 5/hour/IP.
import { NextResponse } from "next/server";
import { claimName } from "@/lib/player";
import { clientIp, limits } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!(await limits.claim.limit(clientIp(req))).success)
    return NextResponse.json({ error: "too many names from this network, try again in an hour" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const res = await claimName(String(body?.name ?? "").trim());
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ name: res.name, secret: res.secret });
}
