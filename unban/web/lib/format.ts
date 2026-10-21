import { GEN } from "./config";

/** Wei as GEN, at most four decimals, trailing zeros dropped. */
export function gen(wei: string | bigint | number): string {
  const value = BigInt(wei);
  const whole = value / GEN;
  const frac = value % GEN;
  if (frac === 0n) return whole.toString();
  const decimals = frac.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return decimals ? `${whole}.${decimals}` : whole.toString();
}

/** A decimal GEN string from a form as wei. */
export function toWei(text: string): bigint {
  const clean = text.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(clean)) throw new Error("Enter an amount like 2 or 0.5");
  const [whole, frac = ""] = clean.split(".");
  return BigInt(whole) * GEN + BigInt(frac.padEnd(18, "0"));
}

export function short(address: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}

export function when(seconds: number): string {
  if (!seconds) return "";
  return new Date(seconds * 1000).toUTCString().replace(":00 GMT", " UTC").replace(/^\w+, /, "");
}

export function duration(seconds: number): string {
  if (seconds <= 0) return "0 m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 48) return `${Math.round(h / 24)} d`;
  if (h > 0) return `${h} h${m && h < 10 ? ` ${m} m` : ""}`;
  return `${m} m`;
}

export function left(deadline: number, now = Math.floor(Date.now() / 1000)): string {
  const rest = deadline - now;
  return rest > 0 ? `${duration(rest)} left` : "window closed";
}
