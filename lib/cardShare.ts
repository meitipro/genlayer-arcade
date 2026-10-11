// lib/cardShare.ts: the text that goes with a shared card. Pure, so the browser
// builds it from the same card data the page shows.
import type { PlayerCard } from "./cardTypes";

/** X counts every link as 23 characters. */
const LIMIT = 280;
const LINK = 23;

const n = (v: number) => v.toLocaleString("en-US");

/**
 * The share text for a card, as `body` (no link, for X's own link field) and
 * `text` (body and link in one string, for share sheets and copying). Lines are
 * dropped from the bottom until it fits a post.
 */
export function shareParts(card: PlayerCard, url: string): { body: string; text: string } {
  const d = card.discord;
  const member = Boolean(d?.isMember);
  const lines: string[] = [`My GenLayer Arcade card: ${card.name}`];
  lines.push(`${card.tier.name} (Tier ${card.tier.n})${member ? ` · ${card.standing}` : ""}`);
  if (card.server) lines.push(`Server: level ${card.server.level} · ${n(card.server.xp)} XP · rank #${n(card.server.rank)}`);
  lines.push(`Arcade: level ${card.level} · ${n(card.xp)} XP · ${card.badges}/10 badges`);
  if (card.best) lines.push(`Best: ${card.best.title} ${n(card.best.score)}`);
  if (member && d && d.roles.length > 1) {
    const shown = d.roles.slice(0, 3).join(", ");
    lines.push(`Roles: ${shown}${d.roles.length > 3 ? ` +${d.roles.length - 3}` : ""}`);
  }
  if (card.x) lines.push(`X: @${card.x.handle}`);
  const fit = () => lines.join("\n").length + 2 + LINK <= LIMIT;
  // keep the header, tier and server/arcade lines; shed the rest from the bottom
  while (!fit() && lines.length > 3) lines.pop();
  const body = lines.join("\n");
  return { body, text: `${body}\n\n${url}` };
}
