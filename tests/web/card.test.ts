// The player card's data, the role table, the Discord gate and handle checks.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ROLE_ID_TO_NAME, ROLE_TIER, ROLE_WEIGHT, TIERS, highestRole, roleNamesFromIds, tierForRole } from "@/lib/roles";
import { cleanHandle } from "@/lib/social";
import { guillocheSVG, sealSVG } from "@/lib/cardSvg";
import { roleHowEarned, tierDoctrine } from "@/lib/lore";

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
    ["github", "https://github.com/meitipro", "meitipro"],
    ["x", "bad handle", null],
    ["x", "a".repeat(16), null],
    ["github", "-bad-", "-bad-"],
  ] as const)("%s %s", (network, raw, want) => {
    expect(cleanHandle(network, raw)).toBe(want);
  });
});

describe("card data and the gate", () => {
  let claim: typeof import("@/app/api/player/claim/route").POST;
  const post = (url: string, body: unknown) =>
    new Request(`http://t${url}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.7.7.7" }, body: JSON.stringify(body) });
  beforeAll(async () => {
    claim = (await import("@/app/api/player/claim/route")).POST;
  });

  it("builds a card from Discord roles: tier from the highest role, stable number, real hash", async () => {
    const { linkDiscord } = await import("@/lib/discord");
    const { cardFor } = await import("@/lib/card");
    const me = await (await claim(post("/api/player/claim", { name: "card_one" }))).json();
    expect(me.name).toBe("card_one");

    const bare = await cardFor("card_one");
    expect(bare?.tier).toEqual({ n: "I", name: "Spark" });
    expect(bare?.standing).toBe("Not connected");
    expect(bare?.discord).toBeNull();

    await linkDiscord("card_one", {
      id: "123456789012345678",
      username: "card.one",
      avatar: null,
      isMember: true,
      highestRole: "Synapse",
      tier: { n: "II", name: "Ember", color: "#FF8A5B" },
      roles: ["Synapse", "Molecule"],
      joinedAt: "2025-03-01T00:00:00Z",
      connectedAt: "2026-10-11T00:00:00Z",
    });
    const card = await cardFor("card_one");
    expect(card?.tier).toEqual({ n: "II", name: "Ember" });
    expect(card?.standing).toBe("Synapse");
    expect(card?.credentialNo).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(card?.recordHash).toMatch(/^0x[0-9a-f]{40}$/);
    expect((await cardFor("CARD_ONE"))?.credentialNo).toBe(card?.credentialNo);
    expect((await cardFor("card_one"))?.recordHash).toBe(card?.recordHash);

    // a different role set is a different record, with the same card number
    await linkDiscord("card_one", {
      id: "123456789012345678",
      username: "card.one",
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
    expect(next?.recordHash).not.toBe(card?.recordHash);
    expect(next?.credentialNo).toBe(card?.credentialNo);
  });

  it("an account that is not in the server gets Spark and says so", async () => {
    const { linkDiscord } = await import("@/lib/discord");
    const { cardFor } = await import("@/lib/card");
    await claim(post("/api/player/claim", { name: "card_two" }));
    await linkDiscord("card_two", {
      id: "223456789012345678",
      username: "outsider",
      avatar: null,
      isMember: false,
      highestRole: "Mindbender",
      tier: { n: "I", name: "Spark", color: "#8A8A9A" },
      roles: [],
      joinedAt: null,
      connectedAt: "2026-10-11T00:00:00Z",
    });
    const c = await cardFor("card_two");
    expect(c?.tier.name).toBe("Spark");
    expect(c?.standing).toBe("Not in the server");
  });

  it("one Discord account plays under one nickname", async () => {
    const { linkDiscord } = await import("@/lib/discord");
    await claim(post("/api/player/claim", { name: "card_three" }));
    const r = await linkDiscord("card_three", {
      id: "123456789012345678", // already linked to card_one
      username: "x",
      avatar: null,
      isMember: true,
      highestRole: "Synapse",
      tier: { n: "II", name: "Ember", color: "#FF8A5B" },
      roles: [],
      joinedAt: null,
      connectedAt: "2026-10-11T00:00:00Z",
    });
    expect(r).toEqual({ ok: false, error: "taken" });
  });

  it("the gate is off until Discord is configured, then needs a connected account", async () => {
    const { discordGate } = await import("@/lib/discord");
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_SECRET;
    expect(await discordGate("card_three")).toBeNull();
    process.env.DISCORD_CLIENT_ID = "id";
    process.env.DISCORD_CLIENT_SECRET = "secret";
    try {
      expect(await discordGate("card_three")).toMatch(/connect your Discord/);
      expect(await discordGate("card_one")).toBeNull();
      expect(await discordGate("w_dd3187d8882872b269")).toBeNull(); // a wallet name is bound to its address
      process.env.ARCADE_REQUIRE_DISCORD = "0";
      expect(await discordGate("card_three")).toBeNull();
    } finally {
      delete process.env.DISCORD_CLIENT_ID;
      delete process.env.DISCORD_CLIENT_SECRET;
      delete process.env.ARCADE_REQUIRE_DISCORD;
    }
  });
});
