// Tournament mode, wallet names and community submission checks, against the
// in-memory store.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { validateSubmission } from "@/lib/community";
import { stateOf, validateEvent } from "@/lib/events";
import { walletName, WALLET_NAME_RE } from "@/lib/wallet";
import { loginAs } from "./helpers";

vi.mock("next/cache", () => ({ revalidateTag: () => {}, unstable_cache: (fn: () => unknown) => fn }));

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://t${url}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.1.2.3", ...headers }, body: JSON.stringify(body) });

describe("wallet names are bound to the address", () => {
  it("derives w_ plus the first 18 hex digits, lowercase", () => {
    expect(walletName("0xDd3187D8882872B26912c42278261C5991c9d84A")).toBe("w_dd3187d8882872b269");
    expect(WALLET_NAME_RE.test(walletName("0xDd3187D8882872B26912c42278261C5991c9d84A"))).toBe(true);
    expect(walletName("0xDd3187D8882872B26912c42278261C5991c9d84A")).toHaveLength(20);
  });
  it("a Discord username shaped like a wallet name gets a different name", async () => {
    const { baseName } = await import("@/lib/player");
    // cut to 17 characters, which cannot be the 20-character wallet shape; a longer name made by
    // adding digits is checked against the shape again when the player is created
    expect(baseName("w_dd3187d8882872b269")).toHaveLength(17);
    expect(baseName("w_dd3187d8882872b")).toBe("w_dd3187d8882872b");
    const me = await loginAs("w_dd3187d8882872b269", { id: "wallet-lookalike" });
    expect(WALLET_NAME_RE.test(me.name)).toBe(false);
  });

});

describe("community submissions: cheap checks before the relayer spends anything", () => {
  it.each([
    ["ok", "https://play2048.co/", null],
    ["ab", "https://play2048.co/", /3 to 60/],
    ["Game", "http://play2048.co/", /https/],
    ["Game", "https://play2048.co/<script>", /https/],
    ["Game", "https://localhost", /https/],
    ["Game", `https://${"a".repeat(200)}.com`, /https/],
  ])("%s %s", (title, url, want) => {
    const r = validateSubmission(title === "ok" ? "2048" : title, url);
    if (want === null) expect(r).toBeNull();
    else expect(r).toMatch(want);
  });
});

describe("tournament mode", () => {
  const T0 = Date.parse("2026-10-17T18:00:00Z");
  afterEach(() => vi.useRealTimers());

  it("validates an event and computes its state", () => {
    const v = validateEvent({ title: "Opening sprint", game: "chain-snake", roomCode: "open-41", startsAt: "2026-10-17T18:00:00Z", endsAt: "2026-10-17T19:00:00Z", rules: "Best run counts\n\n" });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.event.roomCode).toBe("OPEN-41");
    expect(v.event.rules).toEqual(["Best run counts"]);
    expect(stateOf(v.event, T0 - 1)).toBe("upcoming");
    expect(stateOf(v.event, T0 + 1)).toBe("live");
    expect(stateOf(v.event, T0 + 3600001)).toBe("ended");
    expect(validateEvent({ title: "x", game: "chain-snake", roomCode: "AB-1", startsAt: "2026-10-17T18:00:00Z", endsAt: "2026-10-17T19:00:00Z" }).ok).toBe(false);
    expect(validateEvent({ title: "Sprint", game: "verdict", roomCode: "AB-1", startsAt: "2026-10-17T18:00:00Z", endsAt: "2026-10-17T19:00:00Z" }).ok).toBe(false);
    expect(validateEvent({ title: "Sprint", game: "chain-snake", roomCode: "AB-1", startsAt: "2026-10-17T19:00:00Z", endsAt: "2026-10-17T18:00:00Z" }).ok).toBe(false);
  });

  describe("a room code puts a run on the event board too", () => {
    let start: typeof import("@/app/api/session/start/route").POST;
    let score: typeof import("@/app/api/score/route").POST;
    let admin: typeof import("@/app/api/admin/[action]/route").POST;
    beforeAll(async () => {
      process.env.ADMIN_TOKEN = "test-admin-token";
      start = (await import("@/app/api/session/start/route")).POST;
      score = (await import("@/app/api/score/route")).POST;
      admin = (await import("@/app/api/admin/[action]/route")).POST;
    });

    it("refuses unknown, upcoming and wrong-game rooms, accepts a live one, and ranks the run", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(T0 - 600000));
      const ctx = (action: string) => ({ params: Promise.resolve({ action }) });
      const made = await admin(
        post("/api/admin/create-event", { title: "Snake sprint", game: "chain-snake", roomCode: "SNAKE-1", startsAt: "2026-10-17T18:00:00Z", endsAt: "2026-10-17T19:00:00Z" }, { "x-admin-token": "test-admin-token" }),
        ctx("create-event"),
      );
      expect(made.status).toBe(200);
      const id = (await made.json()).event.id;
      const dup = await admin(
        post("/api/admin/create-event", { title: "Other", game: "chain-snake", roomCode: "SNAKE-1", startsAt: "2026-10-18T18:00:00Z", endsAt: "2026-10-18T19:00:00Z" }, { "x-admin-token": "test-admin-token" }),
        ctx("create-event"),
      );
      expect(dup.status).toBe(400);

      const me = await loginAs("room_runner");
      const inRoom = (body: unknown) => post("/api/session/start", body, { cookie: me.cookie });
      expect((await start(inRoom({ game: "chain-snake", room: "NOPE-9" }))).status).toBe(404);
      expect((await start(inRoom({ game: "chain-snake", room: "snake-1" }))).status).toBe(409); // not started
      vi.setSystemTime(new Date(T0 + 60000));
      expect((await start(inRoom({ game: "validator-run", room: "SNAKE-1" }))).status).toBe(400);

      const tok = (await (await start(inRoom({ game: "chain-snake", room: "SNAKE-1" }))).json()).token;
      vi.setSystemTime(new Date(T0 + 70000));
      const r = await score(post("/api/score", { token: tok, score: 80 }, { cookie: me.cookie }));
      expect(r.status).toBe(200);
      expect((await r.json()).event).toEqual({ id, rank: 1 });

      const { redis } = await import("@/lib/redis");
      expect(await redis.ztop(`lb:event:${id}`, 5)).toEqual([{ member: "room_runner", score: 80 }]);
    });
  });
});
