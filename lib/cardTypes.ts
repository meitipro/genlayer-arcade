// lib/cardTypes.ts: the shape of a player card. Plain data, safe in the browser.

export type CardTierInfo = { n: string; name: string };

export type CardDiscord = {
  id: string;
  username: string;
  avatar: string | null;
  isMember: boolean;
  highestRole: string;
  roles: string[];
  joinedAt: string | null;
  connectedAt: string;
};

export type CardSocial = {
  network: "x";
  handle: string;
  name: string;
  avatar: string | null;
  url: string;
  followers: number | null;
  since: string | null;
  verifiedAt: string;
};

export type PlayerCard = {
  name: string;
  since: string | null;
  level: number;
  xp: number;
  badges: number;
  dailies: number;
  best: { game: string; title: string; score: number } | null;
  discord: CardDiscord | null;
  x: CardSocial | null;
  wallet: string | null;
  config: { discord: boolean; x: boolean };
  /** Tier from the highest GenLayer server role. Spark when there is no role to read. */
  tier: CardTierInfo;
  /** What the card says about standing: the highest role, or why there is none. */
  standing: string;
  /** Stable for a player: sha256 of the name and the Discord id. */
  credentialNo: string;
  /** sha256 of this exact record (roles, handles, level), shortened to 40 hex digits. */
  recordHash: string;
  /** Seeds the engraved artwork; changes when the highest role changes. */
  seed: string;
};
