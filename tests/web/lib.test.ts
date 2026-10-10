// Seasons, sessions, validation, XP and the arcade routes, run against the
// in-memory store (no Upstash env in tests).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ONCHAIN } from "@/lib/onchain";
import { formatLeft, previousSeasonId, seasonEnd, seasonId, seasonStart } from "@/lib/season";
import { signSession, verifySession } from "@/lib/session";
import { levelFor, dailyXp } from "@/lib/xp";

vi.mock("next/cache", () => ({ revalidateTag: () => {}, unstable_cache: (fn: () => unknown) => fn }));

describe("seasons are ISO weeks in UTC", () => {
  it.each([
    ["2026-10-10T19:00:00Z", "2026-W41"],
    ["2026-10-12T00:00:00Z", "2026-W42"],
    ["2026-10-11T23:59:59Z", "2026-W41"],
    ["2021-01-03T12:00:00Z", "2020-W53"],
    ["2026-01-01T00:00:00Z", "2026-W01"],
    ["2024-12-30T00:00:00Z", "2025-W01"],
  ])("%s is %s", (iso, want) => expect(seasonId(new Date(iso))).toBe(want));

  it("starts Monday 00:00 UTC and ends a week later", () => {
    const d = new Date("2026-10-10T19:00:00Z");
    expect(seasonStart(d).toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(seasonEnd(d).toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(previousSeasonId(d)).toBe("2026-W40");
    expect(formatLeft(2 * 86400000 + 4 * 3600000 + 5000)).toBe("2d 4h");
  });
});

describe("signed sessions", () => {
  it("round-trips and refuses tampering", () => {
    const tok = signSession("validator-run");
    const s = verifySession(tok)!;
    expect(s.game).toBe("validator-run");
    const [body, sig] = tok.split(".");
    const forged = Buffer.from(JSON.stringify({ ...s, game: "chain-snake" })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`)).toBeNull();
    expect(verifySession(`${body}.${sig.slice(0, -1)}A`)).toBeNull();
    expect(verifySession("garbage")).toBeNull();
    expect(verifySession(undefined)).toBeNull();
  });
});

describe("ONCHAIN validation (cheap checks before the relayer spends anything)", () => {
  it("verdict: 1 to 280 characters", () => {
    expect(ONCHAIN.verdict.validate({ entry: "  " })).toMatch(/1 to 280/);
    expect(ONCHAIN.verdict.validate({ entry: "x".repeat(281) })).toMatch(/1 to 280/);
    expect(ONCHAIN.verdict.validate({ entry: "fine" })).toBeNull();
  });
  it("bridge: 1 to 5 middle words, letters only, all different", () => {
    expect(ONCHAIN.bridge.validate({ chain: "ocean mill" })).toMatch(/1 to 5/);
    expect(ONCHAIN.bridge.validate({ chain: "a b c d e f g h" })).toMatch(/1 to 5/);
    expect(ONCHAIN.bridge.validate({ chain: "ocean salt2 mill" })).toMatch(/letters/);
    expect(ONCHAIN.bridge.validate({ chain: "ocean salt salt mill" })).toMatch(/different/);
    expect(ONCHAIN.bridge.validate({ chain: "ocean salt pepper mill" })).toBeNull();
    expect(ONCHAIN.bridge.toArgs("1", "p", { chain: " Ocean  SALT mill " })).toEqual(["1", "p", "ocean salt mill"]);
  });
  it("oracle: a whole number in range", () => {
    expect(ONCHAIN.oracle.validate({ value: "" })).toMatch(/whole number/);
    expect(ONCHAIN.oracle.validate({ value: "abc" })).toMatch(/whole number/);
    expect(ONCHAIN.oracle.validate({ value: "2000000000" })).toMatch(/between/);
    expect(ONCHAIN.oracle.validate({ value: "82950" })).toBeNull();
    expect(ONCHAIN.oracle.toArgs("3", "p", { value: "17.6" })).toEqual(["3", "p", 18]);
  });
});

describe("XP and levels", () => {
  it("level n needs 100 x n^1.5 total XP", () => {
    expect(levelFor(0).level).toBe(0);
    expect(levelFor(99).level).toBe(0);
    expect(levelFor(100).level).toBe(1);
    expect(levelFor(283).level).toBe(2);
    expect(levelFor(282).level).toBe(1);
  });
  it("daily XP: 40, or 100 for a valid Bridge or a Verdict of 8+", () => {
    expect(dailyXp("verdict", { score: 7 })).toBe(40);
    expect(dailyXp("verdict", { score: 8 })).toBe(100);
    expect(dailyXp("bridge", { valid: false })).toBe(40);
    expect(dailyXp("bridge", { valid: true })).toBe(100);
    expect(dailyXp("oracle", null)).toBe(40);
  });
});

describe("arcade routes (section 8 anti-cheat)", () => {
  let claim: typeof import("@/app/api/player/claim/route").POST;
  let start: typeof import("@/app/api/session/start/route").POST;
  let score: typeof import("@/app/api/score/route").POST;
  let board: typeof import("@/app/api/leaderboard/route").GET;
  const post = (url: string, body: unknown, ip = "10.0.0.1") =>
    new Request(`http://t${url}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

  beforeAll(async () => {
    claim = (await import("@/app/api/player/claim/route")).POST;
    start = (await import("@/app/api/session/start/route")).POST;
    score = (await import("@/app/api/score/route")).POST;
    board = (await import("@/app/api/leaderboard/route")).GET;
  });
  afterEach(() => vi.useRealTimers());

  it("claims a name once, case-insensitively, and returns the secret once", async () => {
    const r = await claim(post("/api/player/claim", { name: "Route_Tester" }));
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.secret).toMatch(/^[0-9a-f]{64}$/);
    expect((await claim(post("/api/player/claim", { name: "route_tester" }))).status).toBe(409);
    expect((await claim(post("/api/player/claim", { name: "no" }))).status).toBe(400);
  });

  it("refuses no token, a reused token, a short run, an implausible rate, another device's name; accepts an honest one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const me = await (await claim(post("/api/player/claim", { name: "honest_one" }))).json();
    const tok = async (game: string) => (await (await start(post("/api/session/start", { game }))).json()).token as string;
    const send = (body: unknown) => score(post("/api/score", body));

    expect((await send({ player: me.name, playerSecret: me.secret, score: 10 })).status).toBe(400);

    let t = await tok("chain-snake");
    vi.setSystemTime(new Date("2026-10-10T12:00:02Z")); // 2 s < minMs 5000
    expect((await send({ token: t, player: me.name, playerSecret: me.secret, score: 10 })).status).toBe(422);

    t = await tok("chain-snake");
    vi.setSystemTime(new Date("2026-10-10T12:00:12Z")); // 10 s x 45/s = 450 max
    expect((await send({ token: t, player: me.name, playerSecret: me.secret, score: 451 })).status).toBe(422);

    t = await tok("chain-snake");
    vi.setSystemTime(new Date("2026-10-10T12:00:22Z"));
    expect((await send({ token: t, player: me.name, playerSecret: "0".repeat(64), score: 100 })).status).toBe(401);
    const ok = await send({ token: t, player: me.name, playerSecret: me.secret, score: 100 });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, season: "2026-W41", best: 100, rank: 1 });
    expect((await send({ token: t, player: me.name, playerSecret: me.secret, score: 100 })).status).toBe(409);

    const b = await (await board(new Request("http://t/api/leaderboard?game=chain-snake&scope=season&player=HONEST_ONE"))).json();
    expect(b.rows[0]).toEqual({ rank: 1, player: "honest_one", score: 100 });
    expect(b.you.rank).toBe(1);
  });

  it("keeps the best score only (ZADD GT)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T13:00:00Z"));
    const me = await (await claim(post("/api/player/claim", { name: "best_only" }))).json();
    for (const [n, at] of [
      [300, "13:00:30"],
      [120, "13:01:30"],
    ] as const) {
      const t = (await (await start(post("/api/session/start", { game: "chain-snake" }))).json()).token;
      vi.setSystemTime(new Date(`2026-10-10T${at}Z`));
      expect((await score(post("/api/score", { token: t, player: me.name, playerSecret: me.secret, score: n }))).status).toBe(200);
    }
    const b = await (await board(new Request("http://t/api/leaderboard?game=chain-snake&scope=all&player=best_only"))).json();
    expect(b.you.score).toBe(300);
  });
});
