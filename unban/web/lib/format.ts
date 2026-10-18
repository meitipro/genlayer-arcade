import { GEN } from "./network";

/** A wei amount as GEN with up to three decimals, never rounded up. */
export function gen(wei: string | bigint | number): string {
  const value = typeof wei === "bigint" ? wei : BigInt(String(wei || "0"));
  const whole = value / GEN;
  const frac = (value % GEN) * 1000n / GEN;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(3, "0").replace(/0+$/, "")}`;
}

export function short(address: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}

export function hours(seconds: number): string {
  if (seconds <= 0) return "0 h";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  return `${Math.round(seconds / 3600)} h`;
}

/** "31 h left", "closed 2 h ago". `now` in seconds. */
export function left(deadline: number, now: number): string {
  const d = deadline - now;
  if (d > 0) return `${hours(d)} left`;
  return `closed ${hours(-d)} ago`;
}

export function when(seconds: number): string {
  if (!seconds) return "";
  return new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** GEN typed by a person, as wei. Refuses anything that is not a plain decimal. */
export function toWei(text: string): bigint {
  const t = text.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(t)) throw new Error("Write the amount as a number, like 2 or 0.5.");
  const [whole, frac = ""] = t.split(".");
  return BigInt(whole) * GEN + BigInt((frac + "0".repeat(18)).slice(0, 18));
}
