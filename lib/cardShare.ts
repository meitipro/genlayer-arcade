// lib/cardShare.ts: the post that goes with a shared card. Pure, so the
// browser builds it from the same card data the page shows.
import type { PlayerCard } from "./cardTypes";

/** X counts every link as 23 characters. */
const LIMIT = 280;
const LINK = 23;

const n = (v: number) => v.toLocaleString("en-US");

/**
 * Letters and digits in Unicode sans-serif bold, the only "bold" a post can
 * carry. Anything else (underscore, spaces) stays as it is.
 */
export function bold(s: string): string {
  return Array.from(s)
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d5d4 + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d5ee + c - 97);
      if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ec + c - 48);
      return ch;
    })
    .join("");
}

/**
 * The length X gives a post: Latin text and common punctuation count 1, every
 * other character (emoji, arrows, bold letters) counts 2.
 */
export function xLength(s: string): number {
  let len = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    len += c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037) ? 1 : 2;
  }
  return len;
}

/**
 * The card as a short structured post: a bold heading, the player and their
 * role, the tier, the server and arcade standing, badges, and a line asking
 * others to post theirs. Lines with nothing behind them (no server role, no
 * MEE6 numbers) are left out rather than made up. `body` has no link (X takes
 * the link in its own field); `text` is body and link together. If a post
 * would run long, the badges and then the server lines are shed.
 */
export function shareParts(card: PlayerCard, url: string): { body: string; text: string } {
  const member = Boolean(card.discord?.isMember);
  const tier = card.tier.name.toLowerCase();
  const role = member ? card.standing.toLowerCase() : "";
  const who = `👤 ${bold(card.name.toLowerCase())}${role && role !== tier ? ` - ${role}` : ""}`;
  const server = card.server ? `▸ server rank: #${n(card.server.rank)}` : null;
  const arcade = `▸ arcade: lvl ${card.level} - ${n(card.xp)} xp`;
  const badges = `▸ badges: ${card.badges}/10`;

  const build = (withServer: boolean, withBadges: boolean) =>
    [
      `🪪 ${bold("GENLAYER ARCADE CARD")}`,
      "",
      who,
      `🏅 tier ${card.tier.n.toLowerCase()} - ${tier}`,
      "",
      ...(withServer && server ? [server] : []),
      arcade,
      ...(withBadges ? [badges] : []),
      "",
      "your turn: grab your card and drop it below 👇",
    ].join("\n");
  const fits = (s: string) => xLength(s) + 2 + LINK <= LIMIT;
  const tries: [boolean, boolean][] = [
    [true, true],
    [true, false],
    [false, false],
  ];
  let body = build(false, false);
  for (const t of tries) {
    const s = build(...t);
    if (fits(s)) {
      body = s;
      break;
    }
  }
  return { body, text: `${body}\n\n${url}` };
}
