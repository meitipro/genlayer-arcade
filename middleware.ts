// middleware.ts: nothing on the site is reachable without a Discord login.
//
// A request with no valid session cookie is sent to /login (pages) or answered
// 401 (API). The exceptions are only what has to work without a session:
// the login page and its two Discord routes, assets, the cron and admin routes
// (they carry their own secrets), the share images, and the share pages for
// link-preview crawlers.
import { NextResponse, type NextRequest } from "next/server";
import { readSessionCookie, SESSION_COOKIE } from "@/lib/sessionCookie";

const PUBLIC_PREFIXES = ["/login", "/api/discord/login", "/api/discord/callback", "/api/cron/", "/api/admin/", "/api/og/", "/_next/", "/brand/"];
const PUBLIC_EXACT = new Set(["/icon.svg", "/favicon.ico", "/robots.txt"]);
const CRAWLERS = /Twitterbot|Discordbot|facebookexternalhit|Slackbot|TelegramBot|WhatsApp|LinkedInBot|Googlebot/i;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => {
    const base = p.replace(/\/$/, "");
    return pathname === base || pathname.startsWith(base + "/");
  });
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  // local development with no Discord application: the dev login route (404 in production)
  if (pathname === "/api/dev/login" && process.env.NODE_ENV !== "production") return NextResponse.next();

  const session = await readSessionCookie(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  // a link preview needs the share page's tags, nothing else
  if (pathname.startsWith("/s/") && CRAWLERS.test(req.headers.get("user-agent") ?? "")) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "sign in with Discord first", gate: "discord" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
