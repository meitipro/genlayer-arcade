// The player card's data, the role table, the Discord gate and handle checks.
import { describe, expect, it, vi } from "vitest";
import { ROLE_ID_TO_NAME, ROLE_TIER, ROLE_WEIGHT, TIERS, highestRole, roleNamesFromIds, tierForRole } from "@/lib/roles";
import { cleanHandle } from "@/lib/social";
import { guillocheSVG, sealSVG } from "@/lib/cardSvg";
import { roleHowEarned, tierDoctrine } from "@/lib/lore";
import { loginAs } from "./helpers";

vi.mock("next/cache", () => ({ revalidateTag: () => {}, unstable_cache: (fn: () => unknown) => fn }));

describe("role table (from meitipro/genlayer-cards)", () => {
  it("weight order agrees with tier order for every pair, so the highest role decides the tier", () => {
    const order = TIERS.map((t) => t.name);
    const names = Object.keys(ROLE_WEIGHT);
    for (const a of names)
      for (const b of names) {
        if (ROLE_WEIGHT[a] > ROLE_WEIGHT[b]) expect(order.indexOf(tierForRole(a).name)).toBeGreaterThanOrEqual(order.indexOf(tierForRole(b).name));
      }
  });

  it("every named role has a weight, a tier and an explanation", () => {
    for (const name of new Set(Object.values(ROLE_ID_TO_NAME))) {
      expect(ROLE_WEIGHT[name], name).toBeGreaterThan(0);
      expect(ROLE_TIER[name], name).toBeDefined();
      expect(roleHowEarned(name), name).not.toMatch(/^Earned through activity and standing/);
    }
  });

  it("maps numeric ids to names, drops unknown ids, and sorts highest first", () => {
    const ids = ["1361979235488759859", "1267783726809612372", "999", "1359471151390261439"];
    expect(roleNamesFromIds(ids)).toEqual(["Synapse", "Molecule", "Mindbender"]);
    expect(highestRole(ids).name).toBe("Synapse");
    expect(highestRole(["1"]).name).toBe("Mindbender");
    expect(tierForRole("Team").name).toBe("True Legends");
    expect(tierDoctrine("Nova")).toMatch(/influence/);
  });
});

describe("card artwork", () => {
  it("is deterministic per seed and differs between seeds", () => {
    expect(guillocheSVG("a#Synapse")).toBe(guillocheSVG("a#Synapse"));
    expect(guillocheSVG("a#Synapse")).not.toBe(guillocheSVG("a#Brain"));
    expect(sealSVG()).toContain("GENLAYER ARCADE");
  });
});

describe("handles", () => {
  it.each([
    ["x", "@Jack", "Jack"],
    ["x", "https://x.com/jack/status/1", "jack"],
    ["x", "bad handle", null],
    ["x", "a".repeat(16), null],
  ] as const)("%s %s", (network, raw, want) => {
    expect(cleanHandle(network, raw)).toBe(want);
  });
});

describe("card data", () => {
  it("builds a card from Discord roles: tier from the highest role, stable number, real hash", async () => {
    const { linkDiscord } = await import("@/lib/discord");
    const { cardFor } = await import("@/lib/card");
    const me = await loginAs("card_one", { id: "123456789012345678", role: "Synapse" });
    expect(me.name).toBe("card_one");

    const first = await cardFor("card_one");
    expect(first?.tier).toEqual({ n: "II", name: "Ember" });
    expect(first?.standing).toBe("Synapse");
    expect(first?.credentialNo).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(first?.recordHash).toMatch(/^0x[0-9a-f]{40}$/);
    expect((await cardFor("CARD_ONE"))?.credentialNo).toBe(first?.credentialNo);
    expect((await cardFor("card_one"))?.recordHash).toBe(first?.recordHash);

    // a different role set is a different record, with the same card number
    await linkDiscord("card_one", {
      id: "123456789012345678",
      username: "card_one",
      avatar: null,
      isMember: true,
      highestRole: "Brain",
      tier: { n: "IV", name: "Nova", color: "#4BE3A6" },
      roles: ["Brain", "Synapse", "Molecule"],
      joinedAt: "2025-03-01T00:00:00Z",
      connectedAt: "2026-10-11T00:00:00Z",
    });
    const next = await cardFor("card_one");
    expect(next?.tier).toEqual({ n: "IV", name: "Nova" });
    expect(next?.recordHash).not.toBe(first?.recordHash);
    expect(next?.credentialNo).toBe(first?.credentialNo);
  });

  it("an account that is not in the server gets Spark and says so", async () => {
    const { cardFor } = await import("@/lib/card");
    await loginAs("card_two", { id: "223456789012345678", member: false });
    const c = await cardFor("card_two");
    expect(c?.tier.name).toBe("Spark");
    expect(c?.standing).toBe("Not in the server");
  });

  it("one Discord account is one player: a second login finds the same name and refreshes the roles", async () => {
    const { cardFor } = await import("@/lib/card");
    const a = await loginAs("card_three", { id: "323456789012345678", role: "Molecule" });
    const b = await loginAs("a_new_username", { id: "323456789012345678", role: "Brain" });
    expect(b.name).toBe(a.name);
    expect((await cardFor(a.name))?.standing).toBe("Brain");
  });

  it("there is no GitHub on the card", async () => {
    const { cardFor } = await import("@/lib/card");
    await loginAs("card_four", { id: "423456789012345678" });
    expect(Object.keys((await cardFor("card_four")) ?? {})).not.toContain("github");
  });
});
