// Share card: the post that goes with it.
import { describe, expect, it } from "vitest";
import type { PlayerCard } from "@/lib/cardTypes";
import { bold, shareParts, xLength } from "@/lib/cardShare";

function card(over: Partial<PlayerCard> = {}): PlayerCard {
  return {
    name: "alice",
    since: "2026-10-01",
    level: 7,
    xp: 1240,
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
  it("is the agreed structured post, then the link", () => {
    const c = card({
      name: "Mahdi",
      level: 7,
      xp: 1240,
      badges: 4,
      tier: { n: "II", name: "Ember" },
      standing: "Synapse",
    });
    const { body, text } = shareParts(c, URL);
    expect(body).toBe(
      [
        `🪪 ${bold("GENLAYER ARCADE CARD")}`,
        "",
        `👤 ${bold("mahdi")} - synapse`,
        "🏅 tier ii - ember",
        "",
        "▸ arcade: lvl 7 - 1,240 xp",
        "▸ badges: 4/10",
        "",
        "your turn: grab your card and drop it below 👇",
      ].join("\n"),
    );
    expect(text).toBe(`${body}

${URL}`);
  });

  it("bold covers letters and digits and leaves the rest", () => {
    expect(bold("ab_9")).toBe("\u{1d5ee}\u{1d5ef}_\u{1d7f5}");
  });

  it("does not say the same word twice when the role is the tier", () => {
    const { body } = shareParts(card({ tier: { n: "V", name: "Singularity" }, standing: "Singularity" }), URL);
    expect(body).toContain(`👤 ${bold("alice")}\n`);
  });

  it("fits a post by X's count (bold letters and emoji count 2, the link 23)", () => {
    const long = card({ name: "a_very_long_name_xyz", standing: "Early Testnet Community Member", tier: { n: "VII", name: "True Legends" } });
    const { body } = shareParts(long, URL);
    expect(xLength(body) + 2 + 23).toBeLessThanOrEqual(280);
    expect(body).toContain("▸ arcade: lvl 7");
    expect(xLength("a🪪")).toBe(3);
  });

  it("takes nothing from Discord but the role", () => {
    const { body } = shareParts(card(), URL);
    expect(body).not.toMatch(/server|rank|messages/);
  });

  it("without a server role it does not make one up", () => {
    const { body } = shareParts(card({ discord: { ...card().discord!, isMember: false, roles: [] } }), URL);
    expect(body).not.toContain("synapse");
    expect(body).toContain("▸ arcade: lvl 7 - 1,240 xp");
  });
});
