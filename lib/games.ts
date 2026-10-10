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
    slug: "sky-hop",
    title: "Sky Hop",
    type: "arcade",
    accent: "#5EEAD4",
    world: "Skyline",
    mood: "aqua skyline, floating blocks, springs",
    tier: "B",
    blurb: "A 2D platformer. Your node bounces up a tower of blocks. Steer left and right, grab votes, and never fall off the chain.",
    idea: "The deeper a block sits under newer blocks, the harder it is to reverse.",
    concept:
      "Each block you land on is another block of history under your feet. The more blocks stacked on top of a transaction, the harder it is to reverse, which is why finality gets stronger with every block.",
    controls: ["Arrow keys or A / D to steer; the node bounces by itself.", "On a phone: hold the left or right side of the screen.", "Red blocks crumble after one bounce. Springs launch you higher."],
    gameOver: "undetermined. you fell off the chain at {n} m",
    // Score is height climbed (1 point per 10 px) plus 5 per vote. A normal
    // bounce climbs at most 118 px (the largest gap) per 0.89 s: 13 points per
    // second. A spring climbs 389 px in 1.35 s: 29 per second, and the votes on
    // the way add at most 11 more. 40 x 1.5 = 60.
    scoring: { maxPerSec: 60, minMs: 1000, cap: 20000 },
    xpDivisor: 40,
    href: "/play/sky-hop",
    learnMore: CONSENSUS,
  },
  {
    slug: "fee-flap",
    title: "Fee Flap",
    type: "arcade",
    accent: "#FFD84D",
    world: "Mempool",
    mood: "yellow pipeline, one-tap flight",
    tier: "B",
    blurb: "One tap to flap. Fly your transaction through the gaps between blocks before it runs out of road. Easy to start, hard to put down.",
    idea: "Every transaction carries fees that pay the leader and the validators for their work.",
    concept:
      "Every transaction carries fees that pay the leader and the validators for the work of running it. A transaction that cannot get through the queue never lands, no matter how good the contract is.",
    controls: ["Space, ArrowUp, click or tap to flap.", "Pass through the gap between two blocks to clear them.", "Touching a block, the floor or the ceiling ends the run."],
    gameOver: "dropped from the mempool. {n} blocks cleared",
    // 10 points per block. Blocks are 290 px apart and the world moves at most
    // 270 px/s: at most 0.93 blocks per second, 9.3 points per second.
    // 9.3 x 1.5 = 14, 15.
    scoring: { maxPerSec: 15, minMs: 1000, cap: 10000 },
    xpDivisor: 25,
    href: "/play/fee-flap",
    learnMore: CONSENSUS,
  },
  {
    slug: "whack-a-node",
    title: "Whack-a-Node",
    type: "arcade",
    accent: "#FF9A3C",
    world: "Slash",
    mood: "orange control wall, pop-up nodes",
    tier: "B",
    blurb: "Faulty nodes pop out of the wall. Slash them before they hide, and leave the honest ones alone. 45 seconds, nine holes, pure reflex.",
    idea: "A validator that misbehaves can be slashed, and its stake is what pays for it.",
    concept:
      "Validators put stake at risk, and a validator that misbehaves can be slashed. The rule only works if it is aimed correctly: slashing an honest validator would hurt the network as much as the fault did.",
    controls: ["Tap or click a red faulty node to slash it.", "Keyboard: 1 to 9, or Q W E / A S D / Z X C.", "Hitting an honest node costs points."],
    gameOver: "round over. {n} faulty nodes slashed",
    // +10 per faulty node. One target appears at most every 0.4 s, 70% of them
    // faulty: 2.5 targets per second, 25 points per second. 25 x 1.5 = 38, 40.
    scoring: { maxPerSec: 40, minMs: 40000, cap: 1500 },
    xpDivisor: 15,
    href: "/play/whack-a-node",
    learnMore: CONSENSUS,
  },
  {
    slug: "node-defender",
    title: "Node Defender",
    type: "arcade",
    accent: "#7C8CFF",
    world: "Shield",
    mood: "periwinkle void, falling faulty blocks",
    tier: "B",
    blurb: "Faulty blocks fall toward the chain. Slide your node, shoot them down before they land, and keep three lives. It fires by itself.",
    idea: "A leader proposes and the others validate, so a faulty proposal is voted down before it lands.",
    concept:
      "A leader proposes a result and the other validators check it. A faulty proposal is voted down before it reaches the chain, which is exactly the job you have here: nothing bad gets through.",
    controls: ["Arrow keys or A / D to slide; your node fires by itself.", "On a phone: hold the left or right side of the screen.", "Armored blocks take two hits. Three lives."],
    gameOver: "chain compromised. {n} faulty blocks stopped",
    // +10 per bullet that hits (a block with two hit points pays 10 per hit).
    // The node fires once per 0.28 s and a bullet hits one block: 3.6 hits per
    // second, 36 points per second. 36 x 1.5 = 54, 55.
    scoring: { maxPerSec: 55, minMs: 1500, cap: 8000 },
    xpDivisor: 30,
    href: "/play/node-defender",
    learnMore: CONSENSUS,
  },
  {
    slug: "stake-merge",
    title: "Stake Merge",
    type: "arcade",
    accent: "#E7B5FF",
    world: "Pool",
    mood: "lilac stake tiles, two minutes on the clock",
    tier: "B",
    blurb: "Slide the stakes. Two equal stakes merge into one twice as big. Build the largest stake you can in two minutes.",
    idea: "Validators and delegators put GEN at stake, and a larger stake carries more weight.",
    concept:
      "Validators and delegators put GEN at stake. Equal stakes combine into a larger one, and a larger stake carries more weight. Here two equal tiles merge into a single tile worth double.",
    controls: ["Arrow keys or W A S D to slide every tile.", "On a phone: swipe anywhere on the board.", "Equal tiles merge. The round lasts two minutes."],
    gameOver: "pool closed. biggest stake {n}",
    // Score is the sum of merged tiles. Moves are limited to one per 0.12 s, so
    // a two-minute round has at most 1000 moves, and each move adds at most
    // 2 or 4 to the total of all tiles: 2.2 x 1000 = 2200, at best a single
    // 2048 tile plus change = 2048 x 10 + small = 22,000 in 120 s. 183 per
    // second, 190. Cap 25,000.
    scoring: { maxPerSec: 190, minMs: 3000, cap: 25000 },
    xpDivisor: 300,
    href: "/play/stake-merge",
    learnMore: CONSENSUS,
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
