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

const URL = "https://genlayergamehub.vercel.app/s/card/Mahdi?v=19233577-66950-270";

describe("share text", () => {
  it("is one lower-case sentence in the agreed shape, then the link", () => {
    const c = card({
      name: "Mahdi",
      level: 1,
      xp: 270,
      badges: 2,
      best: { game: "stake-merge", title: "Stake Merge", score: 2784 },
      server: { level: 29, xp: 66950, rank: 364, messages: 0, at: 0 },
      tier: { n: "V", name: "Singularity" },
      standing: "Regional Moderator",
    });
    const { body, text } = shareParts(c, URL);
    expect(body).toBe(
      "my genlayer arcade card: mahdi, singularity (tier v) and regional moderator, level 29 on the server with 66,950 xp at rank #364, level 1 in the arcade with 270 xp, 2/10 badges and a best of 2,784 in stake merge, the card is not an nft",
    );
    expect(text).toBe(`${body}

${URL}`);
  });

  it("does not say the same word twice when the role is the tier", () => {
    const { body } = shareParts(card({ tier: { n: "V", name: "Singularity" }, standing: "Singularity" }), URL);
    expect(body).toContain("alice, singularity (tier v), level 21");
  });

  it("fits a post: X counts the link as 23 characters, and the closing line is the last thing shed", () => {
    const long = card({ name: "a_very_long_name_x", standing: "Early Testnet Community", tier: { n: "VII", name: "True Legends" }, best: { game: "x", title: "Appeal Breaker", score: 123456789 } });
    const { body } = shareParts(long, URL);
    expect(body.length + 2 + 23).toBeLessThanOrEqual(280);
    expect(body).toContain("level 21 on the server");
    expect(body).toContain("level 7 in the arcade");
  });

  it("without server stats, a best game or a server role it does not make them up", () => {
    const { body } = shareParts(card({ server: null, best: null, discord: { ...card().discord!, isMember: false, roles: [] } }), URL);
    expect(body).not.toContain("on the server");
    expect(body).not.toContain("best of");
    expect(body).not.toContain("synapse");
    expect(body).toBe("my genlayer arcade card: alice, ember (tier ii), level 7 in the arcade with 1,240 xp, 4/10 badges, the card is not an nft");
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
