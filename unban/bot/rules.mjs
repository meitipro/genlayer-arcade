/**
 * The bot's decisions, kept pure so test.mjs can check them without Discord or a chain.
 */

export const DEFAULT_LEVELS = { P1: "warn", P2: "timeout:1440", P3: "timeout:10080" };

/** The handle at the start of a case line: "ardal on Discord, banned 2026-10-06" -> "ardal". */
export function handleOf(caseRef) {
  const m = /^\s*@?([^\s,]+)(?:\s+on\s+|\s*,)/i.exec(String(caseRef));
  return m ? m[1].toLowerCase() : "";
}

/** What to do in Discord for one resolved appeal. */
export function plan(appeal, levels = DEFAULT_LEVELS) {
  if (appeal.status === "OVERTURNED" || appeal.status === "DEFAULTED") return { unban: true, then: null };
  if (appeal.status === "REDUCED") {
    const action = levels[appeal.new_level];
    if (!action) return { unban: false, then: null, note: `${appeal.new_level} is not mapped, so the ban stays as the closest penalty` };
    if (action === "warn") return { unban: true, then: { kind: "warn" } };
    const t = /^timeout:(\d+)$/.exec(action);
    if (t) return { unban: true, then: { kind: "timeout", minutes: Math.min(Number(t[1]), 40320) } };
    return { unban: false, then: null, note: `unknown action ${action}` };
  }
  return { unban: false, then: null };
}

/** The Discord user whose username or global name matches the handle, from the server's ban list. */
export function findBanned(bans, handle) {
  const h = handle.toLowerCase();
  return bans.find((b) => [b.user?.username, b.user?.global_name].some((n) => String(n ?? "").toLowerCase() === h))?.user ?? null;
}
