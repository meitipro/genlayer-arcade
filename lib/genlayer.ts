// lib/genlayer.ts (server only, never import from a client component).
// Every chain call in the site goes through this file (section 16).
//
// Adapted to the SDK that can reach Studionet, genlayer-js 1.2.0 (README,
// "Where the build differs from the spec"):
//   - Studionet has no fee deposits, so writes go without `fees`; the 1.2.0 SDK
//     has no estimateTransactionFeesForWrite. Bradbury would need the 2.x SDK.
//   - getTransaction has no txExecutionResultName on Studionet. Success is read
//     from the leader receipt: execution_result "SUCCESS" and result.status
//     "return". A refusal carries its UserError text in result.payload.
import "server-only";
import { createAccount, createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import deployment from "./deployment.json";
import { redis } from "./redis";

const chain = process.env.GENLAYER_NETWORK === "bradbury" ? testnetBradbury : studionet;

export const readClient = createClient({ chain });

function relayer() {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new Error("RELAYER_PRIVATE_KEY is not set");
  const account = createAccount((key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`);
  return createClient({ chain, account });
}

export type ContractVar = "VERDICT_CONTRACT" | "BRIDGE_CONTRACT" | "ORACLE_CONTRACT" | "LEDGER_CONTRACT";

/** Env var first (section 4), then the address deploy.py recorded. */
export function contractAddress(name: ContractVar): `0x${string}` | null {
  const v = process.env[name] || (deployment.contracts as Record<string, string>)[name];
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : null;
}

const RETRYABLE = /ECONNRESET|ETIMEDOUT|fetch failed|socket|-32029|429|502|503|504|rate limit/i;

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const m = String((e as Error)?.message ?? e);
      if (!RETRYABLE.test(m)) throw e;
      // a per-minute rate limit needs seconds, a dropped socket does not
      await new Promise((r) => setTimeout(r, (/rate limit|-32029|429/i.test(m) ? 6000 : 600) * (i + 1)));
    }
  }
  throw last;
}

export async function readRaw(address: string, functionName: string, args: unknown[] = []): Promise<string> {
  const raw = await withRetry(() =>
    readClient.readContract({ address: address as `0x${string}`, functionName, args: args as never }),
  );
  return raw == null ? "" : String(raw);
}

export async function readJson<T>(address: string, functionName: string, args: unknown[] = []): Promise<T | null> {
  const raw = await readRaw(address, functionName, args);
  return (raw ? JSON.parse(raw) : null) as T | null;
}

/**
 * Submits a write and returns the tx hash without waiting for consensus.
 * Never retried: a lost answer could mean a sent write.
 *
 * The relayer is one account, and the SDK reads its nonce per write, so two
 * requests at once could sign the same nonce. A short Redis lock serializes
 * the relayer across every serverless instance.
 */
export async function relayWrite(address: string, functionName: string, args: unknown[]): Promise<`0x${string}`> {
  const client = relayer();
  const lock = "relayer:lock";
  const deadline = Date.now() + 20000;
  while (!(await redis.set(lock, Date.now(), { nx: true, ex: 90 }))) {
    if (Date.now() > deadline) throw new Error("relayer busy (503): not sent, try again in a minute");
    await new Promise((r) => setTimeout(r, 300));
  }
  try {
    // Studionet allows ~30 RPC requests a minute per IP and one write costs
    // about six. A rate-limited write is retried only while the nonce proves
    // it was never sent; a write whose nonce moved is never sent again.
    const from = client.account!.address;
    for (let attempt = 0; ; attempt++) {
      const before = await withRetry(() => client.getCurrentNonce({ address: from }), 4);
      try {
        const hash = await client.writeContract({
          address: address as `0x${string}`,
          functionName,
          args: args as never,
          value: BigInt(0),
        });
        return hash as `0x${string}`;
      } catch (e) {
        const m = String((e as Error)?.message ?? e);
        if (!RETRYABLE.test(m) || attempt >= 2) throw e;
        await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
        const after = await withRetry(() => client.getCurrentNonce({ address: from }), 4);
        if (Number(after) > Number(before)) throw new Error(`sent, but the answer was lost (nonce ${before} -> ${after}); not resending`);
      }
    }
  } finally {
    await redis.del(lock);
  }
}

export type TxView = {
  status: string; // PENDING, PROPOSING, COMMITTING, REVEALING, ACCEPTED, FINALIZED, UNDETERMINED, CANCELED...
  /** "FINISHED_WITH_RETURN" when the contract returned, "FINISHED_WITH_ERROR" when it raised, "" while pending. */
  result: string;
  /** The contract's own refusal sentence, when it raised. */
  error?: string;
  /** "4 of 5 agree" style vote count, once decided. */
  agree?: number;
  voters?: number;
};

type Receipt = {
  execution_result?: string;
  result?: { status?: string; payload?: unknown };
};

export async function txStatus(hash: `0x${string}`): Promise<TxView> {
  const tx = (await withRetry(() => readClient.getTransaction({ hash: hash as never }))) as unknown as {
    statusName?: string;
    status?: number | string;
    txExecutionResultName?: string;
    consensus_data?: { leader_receipt?: Receipt | Receipt[]; votes?: Record<string, string> };
  };
  const status = String(tx.statusName ?? tx.status ?? "PENDING").toUpperCase();
  const lr = tx.consensus_data?.leader_receipt;
  const leader = Array.isArray(lr) ? lr[0] : lr;
  let result = tx.txExecutionResultName ?? "";
  let error: string | undefined;
  if (leader && leader.execution_result) {
    const returned = String(leader.execution_result).toUpperCase() === "SUCCESS" && leader.result?.status === "return";
    result = returned ? "FINISHED_WITH_RETURN" : "FINISHED_WITH_ERROR";
    if (!returned) {
      const p = leader.result?.payload;
      error = typeof p === "string" ? p : p ? JSON.stringify(p).slice(0, 300) : "the contract raised an error";
    }
  }
  const votes = Object.values(tx.consensus_data?.votes ?? {});
  const decided = votes.filter((v) => v !== "idle");
  return {
    status,
    result,
    error: error ? cleanError(error) : undefined,
    agree: decided.length ? decided.filter((v) => v === "agree").length : undefined,
    voters: decided.length || undefined,
  };
}

/** "[EXPECTED] already submitted" -> "already submitted". */
export function cleanError(e: string): string {
  return e.replace(/^\[(EXPECTED|LLM_ERROR)\]\s*/, "");
}
