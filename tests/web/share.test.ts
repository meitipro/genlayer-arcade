// Share card: the text that goes with it, and the MEE6 server level and XP behind it.
import { describe, expect, it, vi } from "vitest";
import type { PlayerCard } from "@/lib/cardTypes";
import { shareParts } from "@/lib/cardShare";
import { findInPages, refreshMee6, type GetPage, type Row } from "@/lib/mee6";

vi.mock("next/cache", () => ({ revalidateTag: () => {}, unstable_cache: (fn: () => unknown) => fn }));

function card(over: Partial<PlayerCard> = {}): PlayerCard {
  return {
    name: "alice",
    since: "2026-10-01",
    level: 7,
    xp: 1240,
    server: { level: 21, xp: 18420, rank: 1203, messages: 3210, at: 0 },
    badges: 4,
    dailies: 3,
    best: { game: "sky-hop", title: "Sky Hop", score: 1240 },
    discord: { id: "1", username: "alice", avatar: null, isMember: true, highestRole: "Synapse", roles: ["Synapse", "Molecule", "Mindbender", "Testnet", "Neurogamer"], joinedAt: null, connectedAt: "" },
    x: { network: "x", handle: "alice_x", name: "Alice", avatar: null, url: "", followers: null, since: null, verifiedAt: "" },
    wallet: null,
    config: { discord: true, x: true },
    tier: { n: "II", name: "Ember" },
    standing: "Synapse",
    credentialNo: "AB12-CD34",
    recordHash: "0x" + "ab".repeat(20),
    seed: "1#Synapse",
    ...over,
  };
}

const URL = "https://genlayergamehub.vercel.app/s/card/alice?v=x";

describe("share text", () => {
  it("names the role, the server level and XP, the arcade level and XP, and ends with the link", () => {
    const { body, text } = shareParts(card(), URL);
    expect(body).toContain("alice");
    expect(body).toContain("Ember (Tier II) · Synapse");
    expect(body).toContain("Server: level 21 · 18,420 XP · rank #1,203");
    expect(body).toContain("Arcade: level 7 · 1,240 XP · 4/10 badges");
    expect(body).toContain("Best: Sky Hop 1,240");
    expect(text.endsWith(`\n\n${URL}`)).toBe(true);
    expect(body).not.toContain("https://");
  });

  it("fits a post: X counts the link as 23 characters, and the important lines survive", () => {
    const long = card({ name: "a_very_long_name_x", discord: { ...card().discord!, roles: ["Early Testnet Community", "Builder Working Group", "Regional Moderator", "Onboarding Core", "Neurocreative"] } });
    const { body } = shareParts(long, URL);
    expect(body.length + 2 + 23).toBeLessThanOrEqual(280);
    expect(body).toContain("Server: level 21");
    expect(body).toContain("Arcade: level 7");
  });

  it("without server stats or a server role it does not make them up", () => {
    const { body } = shareParts(card({ server: null, discord: { ...card().discord!, isMember: false, roles: [] }, x: null, best: null }), URL);
    expect(body).not.toContain("Server:");
    expect(body).not.toContain("Roles:");
    expect(body).not.toContain("Synapse");
    expect(body).toContain("Arcade: level 7 · 1,240 XP");
  });
});

function board(total: number, ids: Record<number, string> = {}): GetPage {
  // a leaderboard of `total` ranked members, 1000 a page, rank n has id "m<n>" unless overridden
  return async (page) => {
    const rows: Row[] = [];
    for (let i = 0; i < 1000; i++) {
      const rank = page * 1000 + i + 1;
      if (rank > total) break;
      rows.push({ id: ids[rank] ?? `m${rank}`, xp: 100000 - rank, level: 50 - Math.floor(rank / 1000), message_count: rank });
    }
    return rows;
  };
}

describe("MEE6 lookup", () => {
  it("finds a member by id and reports the rank across pages", async () => {
    const r = await findInPages("me", board(7500, { 6234: "me" }));
    expect(r).toEqual({ status: "found", stats: { level: 44, xp: 100000 - 6234, messages: 6234, rank: 6234 } });
  });

  it("an unranked member is absent, and the walk stops at the end of the board", async () => {
    const getPage = vi.fn(board(2400));
    expect(await findInPages("nobody", getPage)).toEqual({ status: "absent" });
    expect(getPage.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("MEE6 being unreachable is not the same as being absent", async () => {
    expect(await findInPages("me", async () => null)).toEqual({ status: "unavailable" });
  });

  it("keeps the answer for 30 minutes, and keeps the old one when MEE6 is down", async () => {
    const id = `keep-${Date.now()}`;
    const getPage = vi.fn(board(3000, { 1500: id }));
    const t0 = 1_800_000_000_000;
    const first = await refreshMee6(id, getPage, t0);
    expect(first.read).toBe(true);
    expect(first.stats?.rank).toBe(1500);
    const calls = getPage.mock.calls.length;
    const again = await refreshMee6(id, getPage, t0 + 60_000);
    expect(again.read).toBe(false);
    expect(getPage.mock.calls.length).toBe(calls);
    const down = await refreshMee6(id, async () => null, t0 + 31 * 60_000);
    expect(down.read).toBe(false);
    expect(down.stats?.rank).toBe(1500);
  });
});
