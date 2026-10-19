/**
 * Everything the site says to Studio Next (chain 61997), for the browser and
 * for scripts/site-e2e.mts, which walks the reviewer's path through this same
 * file with a stand-in wallet.
 *
 * Reads need no wallet. Writes are signed by the visitor's wallet, never by a
 * key on a server: there is no server.
 *
 * The measured rules this keeps, ported from the Recourse Studio Next client:
 *   - Every write on consensus v0.6 carries a fee deposit from Studio's own
 *     estimate of the call; what consensus does not spend comes back.
 *   - withdraw pays out at the root of its own transaction, so it carries an
 *     External allocation naming the payee. Studio cannot simulate a payout.
 *   - A decided transaction is not a successful one: a refusal is decided too.
 *     Success is lifecycle outcome accepted AND execution FINISHED_WITH_RETURN.
 *   - Reads and waits are retried; a write is never resent here, because a
 *     write resent after a lost answer is a second transaction.
 */

import {
  MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
  createClient,
  deriveExternalMessageCallKey,
  encodeExternalMessageFeeParams,
} from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import deployment from "./deployment.json";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const CHAIN_ID = 61997;
export const CHAIN_HEX = "0xf22d";
export const RPC = "https://studio-next.genlayer.com/api";
export const EXPLORER = "https://explorer-studio-dev.genlayer.com";
export const GEN = 10n ** 18n;

export const CONTRACT: string = (deployment as { address?: string }).address ?? "";
export const DEPLOY_TX: string = (deployment as { deploy_tx?: string }).deploy_tx ?? "";

export const TERMS = ["amount", "deliverable", "deadline", "payment", "rights", "cancellation"] as const;
export type Term = (typeof TERMS)[number];
export const REQUIRED: Term[] = ["amount", "deliverable", "deadline"];
export const ZERO = "0x0000000000000000000000000000000000000000";

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;

export function chain(): any {
  return { ...studioDevnet, id: CHAIN_ID, rpcUrls: { default: { http: [RPC] } } };
}

// -- clients -----------------------------------------------------------------

let reader: any = null;

export function readerClient(): any {
  if (!reader) reader = createClient({ chain: chain() });
  return reader;
}

/** A client that signs with an in-memory account (scripts) or through the visitor's wallet. */
export function writerFor(signer: { account: any } | { address: string; provider: any }): any {
  if ("account" in signer) return createClient({ chain: chain(), account: signer.account });
  return createClient({ chain: chain(), account: signer.address as `0x${string}`, provider: signer.provider });
}

export function isTransient(error: unknown): boolean {
  const text = String((error as Error)?.message ?? error);
  return /fetch failed|Failed to fetch|ECONNRESET|socket|network|timed out|timeout|Server busy|-32006|-32029|rate limit|429|502|503|504/i.test(text);
}

export async function retried<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let wait = 1200;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts || !isTransient(error)) throw error;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(Math.round(wait * 1.8), 12000);
    }
  }
}

// -- reads -------------------------------------------------------------------

export type Round = {
  n: number;
  a_sealed: boolean;
  b_sealed: boolean;
  a_opened: boolean;
  b_opened: boolean;
  statuses: string[];
  verdict: "" | "SAME_PAGE" | "DIFFERENT" | "GAPS";
  a_signed: boolean;
  b_signed: boolean;
  sealed_at: number;
  opened_at: number;
  checked_at: number;
  a_seal?: string;
  b_seal?: string;
  a_text?: string;
  b_text?: string;
  a_salt?: string;
  b_salt?: string;
  notes?: Partial<Record<Term, string>>;
  split?: string[];
};

export type Step = "JOINING" | "SEALING" | "OPENING" | "CHECKING" | "SIGNING" | "AGREED" | "NOT_AGREED" | "NO_SHOW";

export type Page = {
  id: number;
  title: string;
  opener: string;
  counterparty: string;
  deposit: string;
  window_hours: number;
  created_at: number;
  step: Step;
  round: number;
  deadline: number;
  absent: string[];
  closed_at: number;
  rounds: Round[];
};

export type Listing = { pages: Page[]; total: number; balance?: string; no_shows?: number; held?: string };

async function readJson<T>(method: string, args: unknown[]): Promise<T> {
  if (!CONTRACT) throw new Error("No contract is deployed in this build.");
  const raw = await retried(() => readerClient().readContract({ address: CONTRACT, functionName: method, args }));
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
}

/** One page, or null when there is no such page (a view that raises answers only "execution failed"). */
export async function readPage(id: number): Promise<Page | null> {
  try {
    return await readJson<Page>("get_page", [id]);
  } catch (error) {
    if (/execution failed|no such page/i.test(String((error as Error)?.message ?? error))) return null;
    throw error;
  }
}

export function listPages(address: string, offset = 0, limit = 20): Promise<Listing> {
  return readJson<Listing>("list_pages", [address, offset, limit]);
}

export async function balanceOf(address: string): Promise<bigint> {
  try {
    const raw = await retried(() => readerClient().getBalance({ address }));
    return BigInt(raw as bigint);
  } catch {
    return 0n;
  }
}

// -- seals -------------------------------------------------------------------

// region: sealOf
/** sha256 over the UTF-8 bytes of "text|salt|address", the address lower case. Same bytes as the contract. */
export async function sealOf(text: string, salt: string, address: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${text}|${salt}|${address.toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
// endregion

/** 16 random bytes as 32 lower-case hex characters. Hex only, so it can never hold the separator. */
export function newSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Characters as the contract counts them: code points, not UTF-16 units and not bytes. */
export function length(text: string): number {
  return Array.from(text).length;
}

// -- writes ------------------------------------------------------------------

const FLAT = { leaderTimeunitsAllocation: 600n, validatorTimeunitsAllocation: 600n, rotations: [1n] };
const EXTERNAL_BUDGET = 10n ** 15n;

export type Call = { functionName: string; args: unknown[]; value?: bigint; account?: any };

/** The fee options for one write, shown to the visitor before they sign. */
export async function feesFor(client: any, call: Call, payee?: string): Promise<any> {
  if (call.functionName === "withdraw") {
    if (!payee) throw new Error("withdraw needs the payee's address");
    const estimate: any = await retried(() =>
      client.estimateTransactionFees({
        ...FLAT,
        messageAllocations: [
          {
            messageType: 0,
            onAcceptance: false,
            parentIndex: MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
            recipient: payee,
            callKey: deriveExternalMessageCallKey("0x"),
            budget: EXTERNAL_BUDGET,
            feeParams: encodeExternalMessageFeeParams({ gasLimit: 100000n, maxGasPrice: 10n ** 9n }),
          },
        ],
      }),
    );
    return pick(estimate);
  }
  let estimate: any;
  try {
    estimate = await retried(() =>
      client.estimateTransactionFeesForWrite({
        address: CONTRACT,
        functionName: call.functionName,
        args: call.args,
        value: call.value ?? 0n,
        ...(call.account ? { account: call.account } : {}),
      }),
    );
  } catch (error) {
    if (isTransient(error)) throw error;
    // A write Studio expects the contract to refuse cannot be simulated; a flat
    // allocation still puts it on chain, where the refusal is recorded.
    estimate = await retried(() => client.estimateTransactionFees({ ...FLAT, totalMessageFees: 0n }));
  }
  return pick(estimate);
}

function pick(estimate: any): any {
  return {
    distribution: estimate.distribution,
    feeValue: estimate.feeValue,
    ...(estimate.messageAllocations?.length ? { messageAllocations: estimate.messageAllocations } : {}),
  };
}

/** The most a write can cost: the fee deposit, most of which comes back. */
export function feeCeiling(fees: any): bigint {
  return BigInt(fees?.feeValue ?? 0);
}

/** The sentence a contract refused with, out of the leader's receipt. */
export function refusalOf(receipt: any): string {
  const rounds = receipt?.consensus_data?.leader_receipt;
  const leader = Array.isArray(rounds) ? rounds.find((r: any) => String(r?.mode ?? "").toLowerCase() === "leader") ?? rounds[0] : rounds;
  const result = leader?.result;
  if (!result) return "";
  if (typeof result === "object") {
    const payload = result.payload;
    if (typeof payload === "string") return payload;
    if (payload && typeof payload === "object" && "readable" in payload) return String(payload.readable);
    return "";
  }
  try {
    return atob(String(result)).slice(1).replace(/[^\x20-\x7e\n]/g, "").trim();
  } catch {
    return "";
  }
}

export function returnedOf(receipt: any): unknown {
  const rounds = receipt?.consensus_data?.leader_receipt;
  const leader = Array.isArray(rounds) ? rounds.find((r: any) => String(r?.mode ?? "").toLowerCase() === "leader") ?? rounds[0] : rounds;
  const result = leader?.result;
  if (result && typeof result === "object" && String(result.status).toLowerCase() === "return") {
    const readable = result.payload?.readable;
    if (typeof readable === "string") {
      try {
        return JSON.parse(readable);
      } catch {
        return readable;
      }
    }
  }
  return undefined;
}

export class Refused extends Error {
  constructor(
    message: string,
    readonly hash: string,
  ) {
    super(message);
  }
}

/** Strip the contract's class prefix for display: "[EXPECTED] no such page" reads "no such page". */
export function plain(sentence: string): string {
  return sentence.replace(/^\[(EXPECTED|LLM_ERROR)\]\s*/, "");
}

/**
 * Write, hand the hash over the moment it exists, wait for the committee's
 * decision, and throw a Refused carrying the contract's own sentence when the
 * decision is not a success.
 */
export async function send(
  client: any,
  call: Call,
  opts: { payee?: string; fees?: any; onHash?: (hash: string) => void; waitUntil?: "decided" | "finalized" } = {},
): Promise<{ hash: string; receipt: any }> {
  const value = call.value ?? 0n;
  const fees = opts.fees ?? (await feesFor(client, call, opts.payee));
  const hash: string = await client.writeContract({
    address: CONTRACT,
    functionName: call.functionName,
    args: call.args,
    value,
    fees,
    ...(call.account ? { account: call.account } : {}),
  });
  opts.onHash?.(hash);
  const receipt: any = await retried(
    () =>
      client.waitForTransactionReceipt({
        hash,
        waitUntil: opts.waitUntil ?? "decided",
        interval: 3000,
        retries: call.functionName === "check" ? 200 : 100,
        fullTransaction: true,
      }),
    4,
  );
  const outcome = String(receipt?.lifecycle?.outcome ?? receipt?.statusName ?? "");
  const execution = String(receipt?.txExecutionResultName ?? "");
  if (outcome !== "accepted" || execution !== "FINISHED_WITH_RETURN") {
    const sentence = refusalOf(receipt);
    throw new Refused(plain(sentence) || `${call.functionName} was not accepted (${outcome || "?"} ${execution}).`.trim(), hash);
  }
  return { hash, receipt };
}

// -- faucet ------------------------------------------------------------------

async function rpc(method: string, params: unknown[]): Promise<any> {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  return response.json();
}

/**
 * Studio's faucet. The amount goes as a decimal string, the address
 * checksummed, and the RPC's answer is ignored: success is the balance moving.
 */
export async function fund(address: string, wei: bigint): Promise<{ before: bigint; after: bigint }> {
  const { getAddress } = await import("viem");
  const target = getAddress(address);
  const before = await balanceOf(target);
  await rpc("sim_fundAccount", [target, wei.toString()]).catch(() => null);
  let after = before;
  for (let i = 0; i < 16 && after <= before; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    after = await balanceOf(target);
  }
  return { before, after };
}

// -- formatting --------------------------------------------------------------

export function gen(wei: string | bigint, digits = 2): string {
  const value = BigInt(wei);
  const whole = value / GEN;
  const frac = value % GEN;
  if (frac === 0n) return whole.toString();
  const text = (Number(frac) / 1e18).toFixed(digits).slice(1);
  return `${whole}${text === ".00" ? "" : text}`;
}

export function short(address: string): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}

export function same(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** The result's name, as the site shows it: SAME PAGE, DIFFERENT · 2, GAPS · 1. */
export function verdictLabel(round: Round): string {
  if (!round.verdict) return "";
  const by = Object.fromEntries(TERMS.map((t, i) => [t, round.statuses[i]]));
  if (round.verdict === "SAME_PAGE") return "SAME PAGE";
  if (round.verdict === "DIFFERENT") return `DIFFERENT · ${TERMS.filter((t) => by[t] === "DIFFER").length}`;
  return `GAPS · ${REQUIRED.filter((t) => by[t] === "ABSENT").length}`;
}
