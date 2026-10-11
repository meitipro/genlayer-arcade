// GET /api/discord/login[?next=/path]: sends the visitor to Discord. The state is
// a random value kept in a short-lived HttpOnly cookie and checked in the
// callback, so a callback that this browser did not start is refused.
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { isHttps } from "@/lib/auth";
import { authorizeUrl, discordConfigured } from "@/lib/discord";
import { clientIp, limits } from "@/lib/ratelimit";
import { NEXT_COOKIE, STATE_COOKIE, safeNext } from "@/lib/loginState";
import { setCookieHeader } from "@/lib/sessionCookie";

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (!discordConfigured()) return NextResponse.redirect(new URL("/login?error=not-configured", u.origin));
  if (!(await limits.session.limit(clientIp(req))).success) return NextResponse.redirect(new URL("/login?error=slow-down", u.origin));
  const state = randomBytes(18).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(u.origin, state));
  const secure = isHttps(req);
  res.headers.append("set-cookie", setCookieHeader(STATE_COOKIE, state, 600, secure));
  res.headers.append("set-cookie", setCookieHeader(NEXT_COOKIE, safeNext(u.searchParams.get("next")), 600, secure));
  return res;
}
