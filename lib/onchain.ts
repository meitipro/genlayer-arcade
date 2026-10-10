// lib/onchain.ts: one config drives all three daily on-chain games (section 11).
// Routes: /api/daily/[game]/{round,submit,status,entry,board}. One
// implementation, parameterised by this table.
import type { ContractVar } from "./genlayer";

export type OnchainGame = "verdict" | "bridge" | "oracle";
export const ONCHAIN_SLUGS: OnchainGame[] = ["verdict", "bridge", "oracle"];

type Body = Record<string, unknown>;

export const ONCHAIN: Record<
  OnchainGame,
  {
    env: ContractVar; // env var holding the contract address
    submitFn: string; // contract method players call through the relayer
    entryFn: string; // views
    boardFn: string;
    toArgs: (rid: string, player: string, body: Body) => unknown[];
    validate: (body: Body) => string | null; // returns an error message or null
    /** Admin actions this game supports (section 11). */
    actions: string[];
  }
> = {
  verdict: {
    env: "VERDICT_CONTRACT",
    submitFn: "submit",
    entryFn: "get_entry",
    boardFn: "get_leaderboard",
    toArgs: (rid, p, b) => [rid, p, String(b.entry).trim()],
    validate: (b) => {
      const n = String(b.entry ?? "").trim().length;
      return n < 1 || n > 280 ? "answer must be 1 to 280 characters" : null;
    },
    actions: ["open", "close"],
  },
  bridge: {
    env: "BRIDGE_CONTRACT",
    submitFn: "submit",
    entryFn: "get_entry",
    boardFn: "get_leaderboard",
    toArgs: (rid, p, b) => [rid, p, String(b.chain).toLowerCase().trim().split(/\s+/).join(" ")],
    validate: (b) => {
      const w = String(b.chain ?? "").trim().split(/\s+/);
      if (w.length < 3 || w.length > 7) return "use 1 to 5 middle words";
      if (!w.every((x) => /^[a-zA-Z]{2,20}$/.test(x))) return "words must be 2 to 20 letters, no digits or symbols";
      if (new Set(w.map((x) => x.toLowerCase())).size !== w.length) return "every word must be different";
      return null;
    },
    actions: ["open", "close"],
  },
  oracle: {
    env: "ORACLE_CONTRACT",
    submitFn: "guess",
    entryFn: "get_guess",
    boardFn: "get_results",
    toArgs: (rid, p, b) => [rid, p, Math.round(Number(b.value))],
    validate: (b) => {
      const s = String(b.value ?? "").trim();
      if (s === "" || !Number.isFinite(Number(s))) return "enter a whole number";
      const n = Math.round(Number(s));
      return n < -1_000_000_000 || n > 1_000_000_000 ? "enter a number between -1,000,000,000 and 1,000,000,000" : null;
    },
    actions: ["open", "lock", "resolve"],
  },
};

export function isOnchain(game: string): game is OnchainGame {
  return (ONCHAIN_SLUGS as string[]).includes(game);
}

// ---- shapes the contracts' JSON views return ----
export type VerdictRound = { id: string; challenge: string; criteria: string; open: boolean; players: number };
export type VerdictEntry = { player: string; entry: string; score: number; reason: string };
export type BridgeRound = { id: string; start: string; end: string; open: boolean; players: number };
export type BridgeEntry = { player: string; chain: string[]; links: boolean[]; valid: boolean; score: number };
export type OracleRound = {
  id: string;
  question: string;
  url: string;
  path: string;
  unit: string;
  state: "open" | "locked" | "resolved";
  answer: number | null;
  players: number;
};
export type OracleResult = { player: string; guess: number; off: number };
export type AnyRound = VerdictRound | BridgeRound | OracleRound;

export function roundIsOpen(game: OnchainGame, r: AnyRound | null): boolean {
  if (!r || !("id" in r)) return false;
  return game === "oracle" ? (r as OracleRound).state === "open" : Boolean((r as VerdictRound).open);
}
