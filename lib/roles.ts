// lib/roles.ts: GenLayer Discord roles and tiers.
//
// Taken from meitipro/genlayer-cards (lib/roles.ts), the same author's project:
// Discord returns numeric role IDs, this table names them, weights pick the
// single highest role, and the highest role's tier is the holder's tier.
// Weight order must agree with tier order; tests/web/card.test.ts holds that.

export type RoleInfo = { name: string; weight: number };
export type Tier = { n: string; name: string; color: string };

export const ROLE_WEIGHT: Record<string, number> = {
  // Tier I: participation
  "Server Booster": 5,
  Testnet: 7,
  Neurogamer: 8,
  Mindbender: 10,
  Molecule: 20,
  // Tier II
  "Early Voyager": 25,
  "Early Testnet Community": 26,
  Synapse: 30,
  // Tier III
  Neurocreative: 42,
  Neurohost: 42,
  // Tier IV
  Brain: 44,
  // Tier V: working groups, Singularity, moderators
  "Portal Working Group": 54,
  "Builder Working Group": 56,
  Singularity: 60,
  "Regional Moderator": 68,
  "Global Moderator": 70,
  // Tier VI / VII
  "Onboarding Core": 78,
  "Builders Core": 78,
  "Content Core": 78,
  "Events Core": 78,
  "Community Core": 78,
  "Discord Core": 80,
  Team: 90,
};

export const ROLE_ID_TO_NAME: Record<string, string> = {
  "1237108294339002388": "Team",
  "1468936804970397737": "Discord Core",
  "1449872845487345706": "Community Core",
  "1466434296322723925": "Events Core",
  "1470487052591169637": "Content Core",
  "1469330355118018726": "Builders Core",
  "1468937597345595507": "Onboarding Core",
  "1346955745845051502": "Global Moderator",
  "1346956348008435742": "Regional Moderator",
  "1408072872605388860": "Singularity",
  "1413509120534773962": "Builder Working Group",
  "1366744984044310568": "Neurocreative",
  "1469096463190724711": "Neurohost",
  "1361982999159115826": "Brain",
  "1267783726809612372": "Synapse",
  "1359471151390261439": "Molecule",
  "1361979235488759859": "Mindbender",
  "1238438366391959606": "Server Booster",
  "1353928786005196821": "Early Voyager",
  "1379234130725703793": "Early Testnet Community",
  "1458097518331297995": "Testnet",
  "1369765612183752937": "Neurogamer",
  "1416048746642276374": "Portal Working Group",
};

export const DEFAULT_ROLE: RoleInfo = { name: "Mindbender", weight: 0 };

export const TIERS: Tier[] = [
  { n: "I", name: "Spark", color: "#8A8A9A" },
  { n: "II", name: "Ember", color: "#FF8A5B" },
  { n: "III", name: "Flare", color: "#FFB547" },
  { n: "IV", name: "Nova", color: "#4BE3A6" },
  { n: "V", name: "Singularity", color: "#3FE0FF" },
  { n: "VI", name: "Legends", color: "#9B7BFF" },
  { n: "VII", name: "True Legends", color: "#FF4FD8" },
];
const [SPARK, EMBER, FLARE, NOVA, SINGULARITY, LEGENDS, TRUE_LEGENDS] = TIERS;

export const ROLE_TIER: Record<string, Tier> = {
  Mindbender: SPARK,
  Molecule: SPARK,
  "Server Booster": SPARK,
  Testnet: SPARK,
  Neurogamer: SPARK,
  Synapse: EMBER,
  "Early Testnet Community": EMBER,
  "Early Voyager": EMBER,
  Neurocreative: FLARE,
  Neurohost: FLARE,
  Brain: NOVA,
  Singularity: SINGULARITY,
  "Regional Moderator": SINGULARITY,
  "Global Moderator": SINGULARITY,
  "Builder Working Group": SINGULARITY,
  "Portal Working Group": SINGULARITY,
  "Onboarding Core": LEGENDS,
  "Builders Core": LEGENDS,
  "Content Core": LEGENDS,
  "Events Core": LEGENDS,
  "Community Core": LEGENDS,
  "Discord Core": LEGENDS,
  Team: TRUE_LEGENDS,
};

export function tierForRole(roleName: string): Tier {
  return ROLE_TIER[roleName] ?? SPARK;
}

/** Numeric role IDs to names, unknown IDs dropped, deduped, highest first. */
export function roleNamesFromIds(roleIds: string[]): string[] {
  const named = (roleIds || []).map((id) => ROLE_ID_TO_NAME[id]).filter((n): n is string => Boolean(n));
  return Array.from(new Set(named)).sort((a, b) => (ROLE_WEIGHT[b] ?? 0) - (ROLE_WEIGHT[a] ?? 0));
}

export function highestRole(roleIds: string[]): RoleInfo {
  const known = (roleIds || [])
    .map((id) => ROLE_ID_TO_NAME[id])
    .filter((n): n is string => Boolean(n))
    .map((name) => ({ name, weight: ROLE_WEIGHT[name] ?? 0 }));
  if (!known.length) return DEFAULT_ROLE;
  return known.sort((a, b) => b.weight - a.weight)[0];
}
