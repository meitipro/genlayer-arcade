// lib/cardShare.ts: the sentence that goes with a shared card. Pure, so the
// browser builds it from the same card data the page shows.
import type { PlayerCard } from "./cardTypes";

/** X counts every link as 23 characters. */
const LIMIT = 280;
const LINK = 23;

const n = (v: number) => v.toLocaleString("en-US");

/**
 * One lower-case sentence: name, tier and highest role, the server level, XP and
 * rank, the arcade level and XP, badges, the best game, and that the card is not
 * an NFT. `body` has no link (X takes the link in its own field); `text` is
 * body and link together. Pieces are shed (best game, then badges, then the
 * closing line) until it fits a post.
 */
export function shareParts(card: PlayerCard, url: string): { body: string; text: string } {
  const member = Boolean(card.discord?.isMember);
  const tier = card.tier.name.toLowerCase();
  const role = member ? card.standing.toLowerCase() : "";
  const head = `my genlayer arcade card: ${card.name.toLowerCase()}, ${tier} (tier ${card.tier.n.toLowerCase()})${role && role !== tier ? ` and ${role}` : ""}`;
  const server = card.server ? `level ${card.server.level} on the server with ${n(card.server.xp)} xp at rank #${n(card.server.rank)}` : null;
  const arcade = `level ${card.level} in the arcade with ${n(card.xp)} xp`;
  const badges = `${card.badges}/10 badges`;
  const best = card.best ? `a best of ${n(card.best.score)} in ${card.best.title.toLowerCase()}` : null;
  const tail = "the card is not an nft";

  const build = (withBest: boolean, withBadges: boolean, withTail: boolean) => {
    const items = [server, arcade].filter((x): x is string => Boolean(x));
    const last = [withBadges ? badges : null, withBest ? best : null].filter((x): x is string => Boolean(x)).join(" and ");
    if (last) items.push(last);
    return [head, ...items, ...(withTail ? [tail] : [])].join(", ");
  };
  const fits = (s: string) => s.length + 2 + LINK <= LIMIT;
  const tries: [boolean, boolean, boolean][] = [
    [true, true, true],
    [false, true, true],
    [false, false, true],
    [false, false, false],
  ];
  let body = build(...tries[tries.length - 1]);
  for (const t of tries) {
    const s = build(...t);
    if (fits(s)) {
      body = s;
      break;
    }
  }
  return { body, text: `${body}\n\n${url}` };
}
