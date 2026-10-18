import type { Appeal, AppealRow } from "./types";

/** What the member gets back, in wei, for a resolved appeal. Mirrors _settle in the contract. */
export function toMember(a: AppealRow): bigint {
  if (a.status === "OVERTURNED" || a.status === "DEFAULTED") return BigInt(a.fee) + BigInt(a.reserved);
  if (a.status === "REDUCED") return BigInt(a.fee);
  return 0n;
}

/** What a read-only bot does with the ruling. */
export function botAction(a: AppealRow | Appeal, ladder?: string[]): string {
  if (a.status === "OVERTURNED" || a.status === "DEFAULTED") return "Lift the ban";
  if (a.status === "REDUCED") {
    const n = Number(a.new_level.replace("P", ""));
    const label = ladder?.[n - 1];
    return `Replace with ${a.new_level}${label ? ` ${label}` : ""}`;
  }
  if (a.status === "UPHELD") return "Ban stays";
  return "Waiting";
}
