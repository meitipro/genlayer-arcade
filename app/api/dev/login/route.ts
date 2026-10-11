// GET /api/dev/login?name=: local development only, when no Discord application
// is configured. It creates a player and a session so the site can be worked on
// without a Discord login. It answers 404 in production and whenever Discord
// is configured, so it can never stand in for the real login.
import { NextResponse } from "next/server";
import { sessionCookieFor } from "@/lib/auth";
import { discordConfigured, loginWithDiscord } from "@/lib/discord";
import { tierForRole } from "@/lib/roles";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || discordConfigured()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const u = new URL(req.url);
  const name = (u.searchParams.get("name") || "dev_player").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 17) || "dev_player";
  const role = u.searchParams.get("role") || "Mindbender";
  const id = "dev-" + name.toLowerCase();
  const player = await loginWithDiscord({
    id,
    username: name,
    avatar: null,
    isMember: u.searchParams.get("member") !== "0",
    highestRole: role,
    tier: tierForRole(role),
    roles: [role],
    joinedAt: "2025-01-01T00:00:00Z",
    connectedAt: new Date().toISOString(),
  });
  const res = NextResponse.redirect(new URL(u.searchParams.get("next") || "/", u.origin));
  res.headers.append("set-cookie", await sessionCookieFor(req, player, id));
  return res;
}
