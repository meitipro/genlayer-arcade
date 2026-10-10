/** Next occurrence of HH:00 UTC. */
export function nextUtc(hour: number, from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour));
  if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
