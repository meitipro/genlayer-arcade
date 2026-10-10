// lib/games.ts: the catalog. One entry per game; every page, route and badge
// reads from here (BUILD_SPEC sections 2, 6, 10 and 18).

export type GameType = "arcade" | "onchain" | "community";

export type Scoring = {
  /** Highest believable score per second of session time. */
  maxPerSec: number;
  /** Shortest believable run, from session start to score post. */
  minMs: number;
  /** Highest score accepted at all. */
  cap: number;
};

export type Game = {
  slug: string;
  title: string;
  type: GameType;
  accent: string;
  world: string;
  mood: string;
  tier: "A" | "B";
  blurb: string;
  idea: string;
  /** The line shown after a run (section 18, concept cards). */
  concept: string;
  /** Up to three lines of how to play. */
  controls: string[];
  gameOver: string;
  scoring?: Scoring;
  /** XP per arcade run is 10 + score / xpDivisor (about 50 for a good run). */
  xpDivisor?: number;
  href: string;
  learnMore: string;
};

const EP = "https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle";
const CONSENSUS = "https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy";

// Scoring limits. The spec's starting values (section 10) are marked "tune in
// block 13". Each limit below is the spec value or, where the game's own rules
// let an honest run go faster, the measured upper rate of the rules with a 1.5x
// margin. The derivation sits next to each number; the README has the table.
export const GAMES: Game[] = [
  {
    slug: "validator-run",
    title: "Validator Run",
    type: "arcade",
    accent: "#3FE0FF",
    world: "Ink and Neon",
    mood: "hand-inked cyan circuitry, speed lines",
    tier: "A",
    blurb: "An endless runner where you are a validator node racing along the chain. Stay online, collect votes, dodge faulty blocks.",
    idea: "Validators are the nodes that execute every Intelligent Contract and vote on the result.",
    concept:
      "Validators are the nodes that execute every Intelligent Contract and vote on the result. A validator that drops out misses the vote, which is exactly what game over feels like here.",
    controls: ["Space, ArrowUp or tap to jump. Hold for a higher jump.", "Collect votes, dodge red faulty blocks.", "P or tab-away pauses."],
    gameOver: "undetermined. your node went offline",
    // Distance pays speed/10 per second; speed caps at 900px/s (90/s), doubled
    // in finality windows (5 of every 30 s) plus one +25 vote about every
    // second: about 120/s flat out. Spec start value 40 rejects an honest
    // 60 s run (about 60/s). 120 x 1.5 = 180.
    scoring: { maxPerSec: 180, minMs: 5000, cap: 200000 },
    xpDivisor: 80,
    href: "/play/validator-run",
    learnMore: CONSENSUS,
  },
  {
    slug: "consensus-stack",
    title: "Consensus Stack",
    type: "arcade",
    accent: "#9B7BFF",
    world: "The Vault",
    mood: "violet datacenter vault, calm and heavy",
    tier: "A",
    blurb: "A one-tap stacker. Each block is a round; drop it on the tower and only the part that agrees with the block below survives.",
    idea: "Consensus means the overlap: only what the majority agrees on becomes part of the chain.",
    concept:
      "Consensus means the overlap: only what the majority agrees on becomes part of the chain. A perfect drop is a round where every validator agreed.",
    controls: ["Tap, click or Space to drop the block.", "Only the overlap with the block below survives.", "Three perfect drops in a row regrow the block."],
    gameOver: "no majority. consensus failed",
    // A block starts 260px from the aligned spot and slides at 180 to 520px/s,
    // so the fastest honest drop is 0.5 s; with a perfect every drop that is
    // 2 blocks/s x 35 = 70/s. 70 x 1.5 = 105. Spec start value 6 rejects any
    // run with perfect drops.
    scoring: { maxPerSec: 105, minMs: 3000, cap: 5000 },
    xpDivisor: 8,
    href: "/play/consensus-stack",
    learnMore: CONSENSUS,
  },
  {
    slug: "leader-rotation",
    title: "Leader Rotation",
    type: "arcade",
    accent: "#FFB547",
    world: "Signal",
    mood: "amber control room, alarm light",
    tier: "A",
    blurb: "A 60-second reflex game on a grid of nine validator nodes. Tap the leader before the window closes. Tap a faulty node and you get slashed.",
    idea: "For each transaction GenLayer selects a leader to propose the result while the others validate.",
    concept:
      "For each transaction GenLayer selects a leader to propose the result while the others validate. If the majority rejects the proposal, the network rotates to a new leader and tries again.",
    controls: ["Tap or click the glowing leader node.", "Keyboard: numpad 1 to 9, or Q W E / A S D / Z X C.", "Never tap a red faulty node."],
    gameOver: "round over. you led {n} rounds",
    // At most two leaders are live and a new one appears 200 ms after a hit,
    // so a perfect player lands about 4 hits/s at combo x8 (80 each): 320/s
    // for short bursts, about 120/s held over a minute. The spec cap of 5000
    // is below a strong run (120 hits x 80), so the cap is 12000 and the rate
    // 120 x 1.5 = 180.
    scoring: { maxPerSec: 180, minMs: 55000, cap: 12000 },
    xpDivisor: 40,
    href: "/play/leader-rotation",
    learnMore: CONSENSUS,
  },
  {
    slug: "equivalence",
    title: "Equivalence",
    type: "arcade",
    accent: "#4BE3A6",
    world: "Mint",
    mood: "mint glass cards, quiet focus",
    tier: "A",
    blurb: "A memory game where pairs are not identical, they are equivalent: two different sentences that mean the same thing.",
    idea: "Validators running an LLM never get word-for-word identical answers.",
    concept:
      "Validators running an LLM never get word-for-word identical answers. GenLayer's Equivalence Principle accepts results that are equivalent under a rule the contract defines, not identical.",
    controls: ["Tap or click two cards to flip them.", "Arrow keys and Enter for keyboard play.", "Match sentences that mean the same thing."],
    gameOver: "time is up. {n} equivalences found",
    // 24 pairs in three levels, each worth 100 + up to 30 time bonus; the
    // fastest honest clear (two flips per pair, preview shown) is about 40 s:
    // 3120 / 40 = 78/s. 78 x 1.5 = 117.
    scoring: { maxPerSec: 117, minMs: 15000, cap: 6000 },
    xpDivisor: 30,
    href: "/play/equivalence",
    learnMore: EP,
  },
  {
    slug: "chain-snake",
    title: "Chain Snake",
    type: "arcade",
    accent: "#B8F35A",
    world: "Lime",
    mood: "lime terminal grid, retro",
    tier: "A",
    blurb: "Classic snake rebuilt around finality. Eat transactions, and every five turn into a finalized block that hardens your tail.",
    idea: "Transactions are proposed, accepted and then finalized after the finality window.",
    concept:
      "Transactions are proposed, accepted and then finalized after the finality window. Here every five eaten transactions become a finalized block, worth more and visibly locked in.",
    controls: ["Arrow keys or WASD to turn.", "On mobile, swipe anywhere on the canvas.", "Avoid walls, your own tail and red faulty blocks."],
    gameOver: "fork detected. chain halted",
    // Each transaction is worth 10 + 50/5 = 20 on average. A new one spawns at
    // least 3 cells away, so at the 70 ms floor tick the best honest rate is
    // one every 0.21 s: about 95/s in theory, under 30/s in any real run.
    // Spec start value 12 rejects a fast early game (one tx per 1 s = 20/s).
    // 30 x 1.5 = 45.
    scoring: { maxPerSec: 45, minMs: 5000, cap: 20000 },
    xpDivisor: 12,
    href: "/play/chain-snake",
    learnMore: CONSENSUS,
  },
  {
    slug: "appeal-breaker",
    title: "Appeal Breaker",
    type: "arcade",
    accent: "#FF4FD8",
    world: "Contagion",
    mood: "magenta corrupted protocol, highest tension",
    tier: "B",
    blurb: "Breakout where the bricks are undetermined transactions. Some need more than one hit, the way a disputed result needs a bigger validator set to settle.",
    idea: "When a result is disputed, an appeal brings in a larger group of validators to re-evaluate it.",
    concept:
      "When a result is disputed, an appeal brings in a larger group of validators to re-evaluate it. Harder bricks need more validators (hits) to resolve.",
    controls: ["Drag, move the mouse or use the arrow keys to move the paddle.", "Space or tap launches the ball.", "Three balls lost ends the run."],
    gameOver: "the appeal failed. {n} transactions resolved",
    // +15 per hit point. Two balls (appeal power-up) at up to 640px/s hit at
    // most about 6 bricks/s: 90/s. Spec start value 60 sits under a good
    // split-ball stretch. 90 x 1.5 = 135.
    scoring: { maxPerSec: 135, minMs: 8000, cap: 30000 },
    xpDivisor: 40,
    href: "/play/appeal-breaker",
    learnMore: "https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/appeal-process",
  },
  {
    slug: "verdict",
    title: "Daily Verdict",
    type: "onchain",
    accent: "#9B7BFF",
    world: "daily",
    mood: "violet courtroom, deliberation",
    tier: "A",
    blurb: "One creative challenge a day. An Intelligent Contract scores your answer from 0 to 10, and the validators each re-score it.",
    idea: "Subjective judgement reaching consensus: the core reason GenLayer exists.",
    concept:
      "An LLM scored your answer inside an Intelligent Contract, and every validator re-scored it on its own. The score only landed because they agreed within one point.",
    controls: ["Write an answer of up to 280 characters.", "Submit once per round.", "Watch the validators settle it."],
    gameOver: "",
    href: "/daily/verdict",
    learnMore: EP,
  },
  {
    slug: "bridge",
    title: "Word Bridge",
    type: "onchain",
    accent: "#FF8A5B",
    world: "daily",
    mood: "coral word map, playful",
    tier: "A",
    blurb: "Two words a day. Build the shortest chain of associated words between them; an LLM judges each link and validators re-judge.",
    idea: "Semantic judgement that no normal smart contract could make, settled by consensus.",
    concept:
      "A normal smart contract cannot tell whether two words belong together. This one asked an LLM about every link, and the validators re-judged the chain before it counted.",
    controls: ["Add 1 to 5 middle words between the two round words.", "Every link must be a real association.", "Fewer hops score more."],
    gameOver: "",
    href: "/daily/bridge",
    learnMore: EP,
  },
  {
    slug: "oracle",
    title: "Oracle Guess",
    type: "onchain",
    accent: "#5AA9FF",
    world: "daily",
    mood: "sky blue data feed, live numbers",
    tier: "A",
    blurb: "Guess a real number from the live web. At the deadline the contract fetches the source itself and validators re-fetch it.",
    idea: "Native web access: the contract is its own oracle, no third-party oracle network.",
    concept:
      "No oracle network was involved. The contract fetched the live source itself, and each validator fetched it again and had to land within 1% before the answer counted.",
    controls: ["Lock in one whole number before 18:00 UTC.", "The contract resolves it from the live source.", "Closest guess wins; earlier guesses win ties."],
    gameOver: "",
    href: "/daily/oracle",
    learnMore: "https://docs.genlayer.com/developers/intelligent-contracts/features/web-access",
  },
];

export const ARCADE = GAMES.filter((g) => g.type === "arcade");
/** The five Tier A arcade games the definition of done names. */
export const CORE_ARCADE = ARCADE.filter((g) => g.tier === "A");
export const ONCHAIN_GAMES = GAMES.filter((g) => g.type === "onchain");

export function gameBySlug(slug: string): Game | undefined {
  return GAMES.find((g) => g.slug === slug);
}

/** Community listing (section 2: "Mochi Run, community, listed, links out"). */
export const COMMUNITY: { title: string; blurb: string; href: string }[] = [];
