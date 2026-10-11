// POST /api/auth/logout: clears the session cookie.
import { NextResponse } from "next/server";
import { clearedSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.headers.append("set-cookie", clearedSessionCookie(req));
  return res;
}
