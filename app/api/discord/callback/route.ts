// GET /api/discord/callback?code&state: Discord sends the player back here.
// The state must match the cookie this browser was given, the code is
// exchanged once, the user and their GenLayer server roles are read, the
// access token is dropped, and the session cookie is set. Always redirects.
import { NextResponse } from "next/server";
import { isHttps, sessionCookieFor } from "@/lib/auth";
import { exchangeCode, fetchStanding, loginWithDiscord } from "@/lib/discord";
import { NEXT_COOKIE, STATE_COOKIE, safeNext } from "@/lib/loginState";
import { cookieFromHeader, setCookieHeader } from "@/lib/sessionCookie";


export async function GET(req: Request) {
  const u = new URL(req.url);
  const cookies = req.headers.get("cookie");
  const secure = isHttps(req);
  const clear = (res: NextResponse) => {
    res.headers.append("set-cookie", setCookieHeader(STATE_COOKIE, "", 0, secure));
    res.headers.append("set-cookie", setCookieHeader(NEXT_COOKIE, "", 0, secure));
    return res;
  };
  const fail = (why: string) => clear(NextResponse.redirect(new URL(`/login?error=${why}`, u.origin)));

  if (u.searchParams.get("error")) return fail("cancelled");
  const state = u.searchParams.get("state") ?? "";
  const code = u.searchParams.get("code") ?? "";
  const expected = cookieFromHeader(cookies, STATE_COOKIE);
  if (!state || !code || !expected || expected !== state) return fail("expired");

  try {
    const token = await exchangeCode(code, u.origin);
    const card = await fetchStanding(token);
    const name = await loginWithDiscord(card);
    const res = NextResponse.redirect(new URL(safeNext(cookieFromHeader(cookies, NEXT_COOKIE)), u.origin));
    res.headers.append("set-cookie", await sessionCookieFor(req, name, card.id));
    return clear(res);
  } catch (e) {
    console.error("discord login failed", String((e as Error)?.message ?? e).slice(0, 200));
    return fail("failed");
  }
}
