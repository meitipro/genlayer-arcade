/**
 * The bot's decisions, with no network in them, so they can be tested.
 * A ruling becomes at most two Discord actions: remove the ban, and for a
 * REDUCED mute level, a timeout for the ladder level's duration.
 */

/** The member's Discord user id: the first 17 to 20 digit number in the case text. */
export function discordId(caseRef) {
  const m = String(caseRef ?? "").match(/(?<!\d)(\d{17,20})(?!\d)/);
  return m ? m[1] : null;
}

const UNITS = { m: 60, min: 60, minute: 60, h: 3600, hr: 3600, hour: 3600, d: 86400, day: 86400, w: 604800, week: 604800 };
const MAX_TIMEOUT = 28 * 86400; // Discord's cap

/** Seconds of timeout a ladder label describes ("24h mute", "7-day mute"), or 0 when it names no duration. */
export function durationOf(label) {
  const m = String(label ?? "").toLowerCase().match(/(\d+)\s*-?\s*(minutes?|min|m|hours?|hr|h|days?|d|weeks?|w)\b/);
  if (!m) return 0;
  const unit = m[2].replace(/s$/, "");
  const seconds = Number(m[1]) * (UNITS[unit] ?? 0);
  return Math.min(seconds, MAX_TIMEOUT);
}

/**
 * What to do for one appeal row from list_appeals. Returns null when the
 * ruling asks nothing of the server (still open, or UPHELD).
 */
export function plan(row) {
  const user = discordId(row.case_ref);
  if (row.status === "OVERTURNED" || row.status === "DEFAULTED") {
    return { appeal: row.id, user, unban: true, timeoutSeconds: 0, text: `${row.status.toLowerCase()}: ban lifted` };
  }
  if (row.status === "REDUCED") {
    const seconds = durationOf(row.new_level_label);
    return {
      appeal: row.id,
      user,
      unban: true,
      timeoutSeconds: seconds,
      text: seconds ? `reduced to ${row.new_level} (${row.new_level_label}): ban lifted, timed out` : `reduced to ${row.new_level} (${row.new_level_label}): ban lifted`,
    };
  }
  return null;
}

/** The rows that still need applying, oldest first. */
export function pending(rows, applied) {
  const done = new Set(applied);
  return rows
    .filter((r) => !done.has(r.id))
    .filter((r) => ["OVERTURNED", "DEFAULTED", "REDUCED", "UPHELD"].includes(r.status))
    .sort((a, b) => a.id - b.id);
}
