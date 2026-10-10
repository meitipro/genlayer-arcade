// lib/season.ts: seasons are ISO weeks in UTC, Monday to Sunday (section 17).

export function seasonId(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
}

/** Monday 00:00 UTC of the week containing d. */
export function seasonStart(d = new Date()): Date {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() - (day - 1));
  return t;
}

/** Next Monday 00:00 UTC: when the current season closes. */
export function seasonEnd(d = new Date()): Date {
  const s = seasonStart(d);
  s.setUTCDate(s.getUTCDate() + 7);
  return s;
}

export function previousSeasonId(d = new Date()): string {
  return seasonId(new Date(seasonStart(d).getTime() - 86400000));
}

/** "2d 4h", "3h 12m", "45m". */
export function formatLeft(ms: number): string {
  if (ms <= 0) return "0m";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}
