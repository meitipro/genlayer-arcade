// lib/lore.ts: the short copy on the back of the card. Structure and the role
// lines are from meitipro/genlayer-cards (lib/lore.ts); the introduction is
// rewritten, because this card is not minted onchain.

export const CARD_INTRO =
  "Your player card in GenLayer Arcade. It shows your tier and roles from the GenLayer Discord server, the accounts you verified, and how you play.";

const TIER_DOCTRINE: Record<string, string> = {
  Spark: "Just arrived and on the record.",
  Ember: "A known, active member of the community.",
  Flare: "A contributor others follow.",
  Nova: "Trusted with real influence.",
  Singularity: "Shapes decisions across the community.",
  Legends: "Part of the team that runs it.",
  "True Legends": "Core team. Sets the direction.",
};

export function tierDoctrine(name: string): string {
  return TIER_DOCTRINE[name] ?? "Standing recognized in the community.";
}

// How this person earned the role: a short explanation of what they did, shown
// when a role on the back of the card is tapped.
const ROLE_HOW_EARNED: Record<string, string> = {
  Team: "Part of the GenLayer team.",
  "Discord Core": "Chosen by the team to help lead moderation and keep the Discord running.",
  "Community Core": "Chosen by the team to lead community support and events.",
  "Events Core": "Chosen by the team to plan and run community events.",
  "Content Core": "Chosen by the team to lead content and contests.",
  "Builders Core": "Chosen by the team to mentor builders on GenLayer.",
  "Onboarding Core": "Chosen by the team to welcome and guide new members.",
  "Global Moderator": "Trusted by the team to moderate across the whole server.",
  "Regional Moderator": "Trusted by the team to moderate their region.",
  Singularity: "Reached level 46 and passed team validation, with a track record of high-impact contribution.",
  Brain: "Reached level 32 through steady activity, community points, and POAPs.",
  Synapse: "Reached level 16 through consistent activity in the community.",
  Molecule: "Stayed active in Discord and reached level 1.",
  Mindbender: "Joined the GenLayer Discord, verified, and started taking part.",
  "Builder Working Group": "Hand-picked by the team for real builder contributions.",
  Neurocreative: "Hand-picked by the team for consistently great content.",
  Neurohost: "Applied and was chosen to host community events.",
  "Server Booster": "Boosts the GenLayer Discord server.",
  "Early Voyager": "Was part of the community in its earliest days.",
  "Early Testnet Community": "Took part in the early testnet.",
  Testnet: "Took part in the GenLayer testnet.",
  Neurogamer: "Plays and competes in the community's games.",
  "Portal Working Group": "Part of the working group around the GenLayer portal.",
};

export function roleHowEarned(name: string): string {
  return ROLE_HOW_EARNED[name] ?? "Earned through activity and standing in the GenLayer community.";
}
