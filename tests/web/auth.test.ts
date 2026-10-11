// The Discord-only login: the session cookie, the middleware that keeps every
// signed-out visitor on /login, and the OAuth round trip with Discord mocked.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPublicPath, middleware } from "../../middleware";
import { cookieFromHeader, readSessionCookie, SESSION_COOKIE, signSessionCookie } from "@/lib/sessionCookie";
import { safeNext } from "@/lib/loginState";
import { loginAs } from "./helpers";

vi.mock("next/cache", () => ({ revalidateTag: () => {}, unstable_cache: (fn: () => unknown) => fn }));

const page = (path: string, init: { cookie?: string; ua?: string } = {}) =>
  new NextRequest(`https://arcade.test${path}`, { headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.ua ? { "user-agent": init.ua } : {}) } });

describe("session cookie", () => {
  it("round-trips and refuses tampering, truncation and age", async () => {
    const v = await signSessionCookie({ name: "alice", did: "111" }, 1_000_000);
    expect(await readSessionCookie(v, 1_000_500)).toEqual({ name: "alice", did: "111" });
    const [body, sig] = v.split(".");
    const other = Buffer.from(JSON.stringify({ n: "bob", d: "111", t: 1_000_000 })).toString("base64url");
    expect(await readSessionCookie(`${other}.${sig}`, 1_000_500)).toBeNull();
    expect(await readSessionCookie(`${body}.${sig.slice(0, -1)}A`, 1_000_500)).toBeNull();
    expect(await readSessionCookie(body, 1_000_500)).toBeNull();
    expect(await readSessionCookie("", 1_000_500)).toBeNull();
    expect(await readSessionCookie(v, 1_000_000 + 31 * 86400 * 1000)).toBeNull();
  });

  it("reads one cookie out of a header", () => {
    expect(cookieFromHeader("a=1; arcade_session=abc%2Edef; b=2", SESSION_COOKIE)).toBe("abc.def");
    expect(cookieFromHeader("a=1", SESSION_COOKIE)).toBeUndefined();
    expect(cookieFromHeader(null, SESSION_COOKIE)).toBeUndefined();
  });
});

describe("the gate: nothing is reachable without a Discord login", () => {
  it.each(["/", "/games", "/play/chain-snake", "/daily/verdict", "/leaderboard", "/seasons", "/events", "/card", "/p/someone", "/admin", "/how", "/undetermined"])(
    "%s sends a signed-out visitor to /login",
    async (path) => {
      const res = await middleware(page(path));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    },
  );

  it("remembers where they were going", async () => {
    const res = await middleware(page("/play/chain-snake?room=ABC"));
    expect(new URL(res.headers.get("location")!).searchParams.get("next")).toBe("/play/chain-snake?room=ABC");
  });

  it.each(["/api/score", "/api/session/start", "/api/leaderboard", "/api/me", "/api/card/x", "/api/rpc", "/api/faucet", "/api/daily/verdict/round", "/api/community/list", "/api/events"])(
    "%s answers 401 to a signed-out request",
    async (path) => {
      const res = await middleware(page(path));
      expect(res.status).toBe(401);
      expect((await res.json()).gate).toBe("discord");
    },
  );

  it("lets through only what has to work signed out", () => {
    for (const p of ["/login", "/api/discord/login", "/api/discord/callback", "/api/cron/daily", "/api/cron/oracle", "/api/admin/open", "/api/og/home", "/brand/genlayer-arcade-icon-512.png", "/icon.svg", "/_next/static/x.js"])
      expect(isPublicPath(p), p).toBe(true);
    for (const p of ["/", "/games", "/api/score", "/api/me", "/api/discord/start", "/login-bypass", "/api/discordx", "/api/cronx"])
      expect(isPublicPath(p), p).toBe(false);
  });

  it("a valid session passes, a forged or expired one does not", async () => {
    const me = await loginAs("gate_user");
    const ok = await middleware(page("/games", { cookie: me.cookie }));
    expect(ok.headers.get("location")).toBeNull();
    expect(ok.status).toBe(200);
    const forged = await middleware(page("/games", { cookie: `${SESSION_COOKIE}=${me.cookie.split("=")[1].slice(0, -3)}abc` }));
    expect(forged.status).toBe(307);
    const old = await signSessionCookie({ name: "gate_user", did: me.id }, Date.now() - 40 * 86400 * 1000);
    expect((await middleware(page("/games", { cookie: `${SESSION_COOKIE}=${encodeURIComponent(old)}` }))).status).toBe(307);
  });

  it("link-preview crawlers get the share page's tags and nothing else", async () => {
    expect((await middleware(page("/s/chain-snake/100/someone", { ua: "Mozilla/5.0 (compatible; Discordbot/2.0)" }))).status).toBe(200);
    expect((await middleware(page("/s/chain-snake/100/someone", { ua: "Mozilla/5.0 Chrome/120" }))).status).toBe(307);
    expect((await middleware(page("/games", { ua: "Twitterbot/1.0" }))).status).toBe(307);
  });
});

describe("login redirect targets", () => {
  it.each([
    ["/play/chain-snake?room=A", "/play/chain-snake?room=A"],
    ["//evil.example", "/"],
    ["https://evil.example/x", "/"],
    ["/\\evil", "/"],
    ["/login", "/"],
    ["/api/score", "/"],
    [undefined, "/"],
  ])("%s", (raw, want) => expect(safeNext(raw as string | undefined)).toBe(want));
});

describe("the Discord round trip", () => {
  const ORIGIN = "https://arcade.test";
  let login: typeof import("@/app/api/discord/login/route").GET;
  let callback: typeof import("@/app/api/discord/callback/route").GET;
  let me: typeof import("@/app/api/me/route").GET;
  let logout: typeof import("@/app/api/auth/logout/route").POST;

  beforeEach(async () => {
    process.env.DISCORD_CLIENT_ID = "1516735150854246480";
    process.env.DISCORD_CLIENT_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
    login = (await import("@/app/api/discord/login/route")).GET;
    callback = (await import("@/app/api/discord/callback/route")).GET;
    me = (await import("@/app/api/me/route")).GET;
    logout = (await import("@/app/api/auth/logout/route")).POST;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_SECRET;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  const cookiesOf = (res: Response) =>
    Object.fromEntries(
      res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0].split("="))
        .map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]),
    );

  it("sends the visitor to Discord with the right client, redirect, scopes and a state cookie", async () => {
    const res = await login(new Request(`${ORIGIN}/api/discord/login?next=/games`, { headers: { "x-forwarded-for": "10.9.0.1" } }));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get("location")!);
    expect(to.origin + to.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(to.searchParams.get("client_id")).toBe("1516735150854246480");
    expect(to.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/discord/callback`);
    expect(to.searchParams.get("scope")).toBe("identify guilds.members.read");
    expect(to.searchParams.get("response_type")).toBe("code");
    const c = cookiesOf(res);
    expect(c.arcade_oauth_state).toBe(to.searchParams.get("state"));
    expect(c.arcade_next).toBe("/games");
    expect(res.headers.getSetCookie().every((x) => x.includes("HttpOnly") && x.includes("SameSite=Lax"))).toBe(true);
  });

  it("refuses a callback that this browser did not start", async () => {
    const noCookie = await callback(new Request(`${ORIGIN}/api/discord/callback?code=abc&state=s1`));
    expect(new URL(noCookie.headers.get("location")!).search).toBe("?error=expired");
    const wrong = await callback(new Request(`${ORIGIN}/api/discord/callback?code=abc&state=s1`, { headers: { cookie: "arcade_oauth_state=other" } }));
    expect(new URL(wrong.headers.get("location")!).search).toBe("?error=expired");
    const cancelled = await callback(new Request(`${ORIGIN}/api/discord/callback?error=access_denied&state=s1`));
    expect(new URL(cancelled.headers.get("location")!).search).toBe("?error=cancelled");
  });

  it("signs a member in: the player is made from the Discord name, roles set the tier, the session works", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.endsWith("/oauth2/token")) return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
        if (u.endsWith("/users/@me")) return new Response(JSON.stringify({ id: "900000000000000001", username: "round.trip", global_name: "Round Trip", avatar: null }), { status: 200 });
        if (u.includes("/guilds/") && u.endsWith("/member")) return new Response(JSON.stringify({ roles: ["1267783726809612372", "1359471151390261439"], joined_at: "2025-03-01T00:00:00Z" }), { status: 200 });
        return new Response("{}", { status: 404 });
      }),
    );
    const res = await callback(new Request(`${ORIGIN}/api/discord/callback?code=abc&state=st`, { headers: { cookie: "arcade_oauth_state=st; arcade_next=%2Fcard" } }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/card");
    const c = cookiesOf(res);
    expect(c[SESSION_COOKIE]).toBeTruthy();
    expect(c.arcade_oauth_state).toBe(""); // cleared

    const who = await me(new Request(`${ORIGIN}/api/me`, { headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(c[SESSION_COOKIE])}` } }));
    expect(who.status).toBe(200);
    const body = await who.json();
    expect(body.name).toBe("RoundTrip");
    expect(body.discord).toMatchObject({ username: "Round Trip", isMember: true, highestRole: "Synapse" });
    const { cardFor } = await import("@/lib/card");
    expect((await cardFor("RoundTrip"))?.tier).toEqual({ n: "II", name: "Ember" });
  });

  it("signs in an account that is not in the GenLayer server too, with no roles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.endsWith("/oauth2/token")) return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
        if (u.endsWith("/users/@me")) return new Response(JSON.stringify({ id: "900000000000000002", username: "outsider", avatar: "abc" }), { status: 200 });
        return new Response("{}", { status: 404 });
      }),
    );
    const res = await callback(new Request(`${ORIGIN}/api/discord/callback?code=abc&state=st`, { headers: { cookie: "arcade_oauth_state=st" } }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    const { cardFor } = await import("@/lib/card");
    const c = await cardFor("outsider");
    expect(c?.standing).toBe("Not in the server");
    expect(c?.discord?.avatar).toContain("cdn.discordapp.com/avatars/900000000000000002/abc");
  });

  it("a failed token exchange lands on /login with an error, and sets no session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })));
    const res = await callback(new Request(`${ORIGIN}/api/discord/callback?code=bad&state=st`, { headers: { cookie: "arcade_oauth_state=st" } }));
    expect(new URL(res.headers.get("location")!).search).toBe("?error=failed");
    expect(cookiesOf(res)[SESSION_COOKIE]).toBeUndefined();
  });

  it("a session whose Discord account no longer owns the name is refused", async () => {
    const mine = await loginAs("owner_check", { id: "910000000000000001" });
    const { redis } = await import("@/lib/redis");
    await redis.hset("player:owner_check", { discordId: "someone-else" });
    const r = await me(new Request(`${ORIGIN}/api/me`, { headers: { cookie: mine.cookie } }));
    expect(r.status).toBe(401);
  });

  it("sign out clears the cookie", async () => {
    const res = await logout(new Request(`${ORIGIN}/api/auth/logout`, { method: "POST" }));
    expect(res.headers.getSetCookie()[0]).toMatch(/arcade_session=;.*Max-Age=0/);
  });

  it("without Discord keys the login page route says so instead of failing", async () => {
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_SECRET;
    const res = await login(new Request(`${ORIGIN}/api/discord/login`, { headers: { "x-forwarded-for": "10.9.0.2" } }));
    expect(new URL(res.headers.get("location")!).search).toBe("?error=not-configured");
  });
});
