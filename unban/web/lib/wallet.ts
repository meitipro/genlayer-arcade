"use client";

/**
 * Writes, signed in the visitor's own wallet. No key ever reaches a server.
 *
 * The rules this file keeps, all measured on Studio Next by the Recourse port:
 *   - Every write carries a fee deposit from Studio's own estimate of the call.
 *     A call Studio cannot simulate gets a flat allocation and goes on chain,
 *     where a refusal is recorded like anything else.
 *   - withdraw() pays at the root of its transaction, so it carries an External
 *     allocation for the payee, or it ends "fee no_matching_allocation".
 *   - Decided is not success. Success is outcome "accepted" and execution
 *     FINISHED_WITH_RETURN; anything else is a refusal with the contract's own
 *     sentence.
 *   - A write is never retried here: a write resent after a lost answer is a
 *     second appeal fee.
 */

import {
  MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
  MessageType,
  createClient,
  deriveExternalMessageCallKey,
  encodeExternalMessageFeeParams,
} from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

import { CHAIN_HEX, CHAIN_ID, CHAIN_NAME, EXPLORER, RPC } from "./network";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The RPC the browser talks to: this site's own /api/rpc, which forwards to
 * Studio Next. Studio does not reliably send CORS headers, and a browser read
 * that fails on CORS looks exactly like a broken contract. The wallet's own
 * signing still goes to the RPC the wallet was given.
 */
export function rpcUrl(): string {
  return typeof window === "undefined" ? RPC : `${window.location.origin}/api/rpc`;
}

export function chainFor(): any {
  return { ...studioDevnet, id: CHAIN_ID, rpcUrls: { default: { http: [rpcUrl()] } } };
}

export function ethereum(): any {
  const eth = (globalThis as any).ethereum;
  if (!eth?.request) throw new WalletError("no_wallet", "No wallet was found in this browser. Install MetaMask, reload, and connect.");
  return eth;
}

export class WalletError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly hash = "",
  ) {
    super(message);
  }
}

function codeOf(error: any): number | undefined {
  return error?.code === -32603 ? error?.data?.originalError?.code ?? error?.data?.code : error?.code;
}

export async function switchNetwork(): Promise<void> {
  const eth = ethereum();
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (error: any) {
    if (codeOf(error) !== 4902) throw error;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CHAIN_HEX,
        chainName: CHAIN_NAME,
        rpcUrls: [RPC],
        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        blockExplorerUrls: [EXPLORER],
      }],
    });
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  }
}

export async function balanceOf(address: string): Promise<bigint> {
  const response = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
  });
  return BigInt((await response.json())?.result ?? "0x0");
}

export function writer(address: string): any {
  return createClient({ chain: chainFor(), account: address as `0x${string}`, provider: ethereum() });
}

export function reader(): any {
  return createClient({ chain: chainFor() });
}

/** A client that signs in the browser with an in-memory test account (the /run page). */
export function localWriter(account: any): any {
  return createClient({ chain: chainFor(), account });
}

/** The flat allocation for a write Studio cannot simulate. 600 is the most a phase may ask for. */
const FLAT = { leaderTimeunitsAllocation: 600n, validatorTimeunitsAllocation: 600n, rotations: [1n] };

export function externalNode(recipient: string) {
  return {
    messageType: MessageType.External,
    onAcceptance: false,
    parentIndex: MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
    recipient: recipient as `0x${string}`,
    callKey: deriveExternalMessageCallKey("0x"),
    budget: 10n ** 15n,
    feeParams: encodeExternalMessageFeeParams({ gasLimit: 100000n, maxGasPrice: 10n ** 9n }),
  };
}

export function transient(error: unknown): boolean {
  return /fetch failed|ECONNRESET|network|timed out|timeout|busy|-32006|-32029|rate limit|429|502|503|504/i.test(String((error as Error)?.message ?? error));
}

export async function retried<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let wait = 1200;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts || !transient(error)) throw error;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(wait * 2, 10000);
    }
  }
}

export async function feesFor(client: any, call: { address: string; functionName: string; args: unknown[]; value: bigint; from: string }): Promise<any> {
  if (call.functionName !== "withdraw") {
    try {
      const estimate: any = await retried(() =>
        client.estimateTransactionFeesForWrite({ address: call.address, functionName: call.functionName, args: call.args, value: call.value }),
      );
      return {
        distribution: estimate.distribution,
        feeValue: estimate.feeValue,
        ...(estimate.messageAllocations?.length ? { messageAllocations: estimate.messageAllocations } : {}),
      };
    } catch (error) {
      if (transient(error)) throw error;
      // Studio could not simulate it: most often a call the contract will refuse.
    }
  }
  const options: any = call.functionName === "withdraw" ? { ...FLAT, messageAllocations: [externalNode(call.from)] } : { ...FLAT, totalMessageFees: 0n };
  const flat: any = await retried(() => client.estimateTransactionFees(options));
  return {
    distribution: flat.distribution,
    feeValue: flat.feeValue,
    ...(flat.messageAllocations?.length ? { messageAllocations: flat.messageAllocations } : {}),
  };
}

function leaderOf(receipt: any): any {
  const rounds = receipt?.consensus_data?.leader_receipt;
  return Array.isArray(rounds) ? rounds.find((r: any) => String(r?.mode ?? "").toLowerCase() === "leader") ?? rounds[0] : rounds;
}

/** The sentence a contract refused with, out of either shape Studio sends it in. */
export function refusalOf(receipt: any): string {
  const result = leaderOf(receipt)?.result;
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

/** The value a successful write returned, or undefined. */
export function returnedOf(receipt: any): unknown {
  const result = leaderOf(receipt)?.result;
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

/** One test for success, shared by every write on the site (rule 22). */
export function succeeded(receipt: any): boolean {
  const outcome = String(receipt?.lifecycle?.outcome ?? receipt?.statusName ?? "").toLowerCase();
  const execution = String(receipt?.txExecutionResultName ?? "");
  return outcome === "accepted" && execution === "FINISHED_WITH_RETURN";
}

export type Phase = "estimating" | "signing" | "reviewing" | "finalizing";

/**
 * Write, report the hash the moment it exists, wait for the validators'
 * decision, and throw a WalletError carrying the contract's own sentence when
 * the decision is not a success.
 */
export async function send(
  from: string,
  call: { address: string; functionName: string; args: unknown[]; value?: bigint },
  onPhase?: (phase: Phase, hash?: string) => void,
  waitUntil: "decided" | "finalized" = "decided",
): Promise<{ hash: string; receipt: any }> {
  const eth = ethereum();
  const current = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
  if (current !== CHAIN_HEX) await switchNetwork();
  return sendWith(writer(from), from, call, onPhase, waitUntil);
}

/** The write itself, for a wallet client or an in-memory account alike. */
export async function sendWith(
  client: any,
  from: string,
  call: { address: string; functionName: string; args: unknown[]; value?: bigint },
  onPhase?: (phase: Phase, hash?: string) => void,
  waitUntil: "decided" | "finalized" = "decided",
): Promise<{ hash: string; receipt: any }> {
  const value = call.value ?? 0n;
  onPhase?.("estimating");
  const fees = await feesFor(client, { ...call, value, from });
  onPhase?.("signing");
  let hash: string;
  try {
    hash = await client.writeContract({ address: call.address, functionName: call.functionName, args: call.args, value, fees });
  } catch (error: any) {
    if (codeOf(error) === 4001 || /rejected|denied/i.test(String(error?.message))) throw new WalletError("rejected", "You declined the transaction in your wallet. Nothing was sent.");
    if (/insufficient/i.test(String(error?.message))) throw new WalletError("no_gen", "This wallet does not have enough GEN for the value and the fee deposit. Use the faucet, then try again.");
    throw new WalletError("send_failed", `The wallet could not send it: ${String(error?.shortMessage ?? error?.message ?? error).slice(0, 160)}`);
  }
  onPhase?.("reviewing", hash);
  const receipt: any = await retried(
    () => reader().waitForTransactionReceipt({ hash, waitUntil, interval: 3000, retries: 120, fullTransaction: true }),
    4,
  ).catch(() => {
    throw new WalletError("no_decision", "The validators have not decided yet. The transaction is on the explorer; reload this page in a minute.", hash);
  });
  if (!succeeded(receipt)) {
    const sentence = refusalOf(receipt).replace(/^\[[A-Z_]+\]\s*/, "");
    throw new WalletError("refused", sentence ? `The contract refused it: ${sentence}.` : `It was not accepted (${String(receipt?.lifecycle?.outcome ?? receipt?.statusName ?? "unknown")}).`, hash);
  }
  // Drop the site's read cache so the page shows what just happened.
  await fetch("/api/revalidate", { method: "POST" }).catch(() => {});
  return { hash, receipt };
}

/** Deploys contracts/unban.py from the visitor's wallet and returns its address. */
export async function deployFromWallet(from: string, code: string, onPhase?: (phase: Phase, hash?: string) => void): Promise<{ address: string; hash: string }> {
  const eth = ethereum();
  const current = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
  if (current !== CHAIN_HEX) await switchNetwork();
  return deployWith(writer(from), code, onPhase);
}

/** The deploy itself, for a wallet client or an in-memory account alike. */
export async function deployWith(client: any, code: string, onPhase?: (phase: Phase, hash?: string) => void): Promise<{ address: string; hash: string }> {
  onPhase?.("estimating");
  const estimate: any = await retried(() => client.estimateTransactionFees({ ...FLAT, totalMessageFees: 0n }));
  onPhase?.("signing");
  const hash: string = await client.deployContract({ code, args: [], fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
  onPhase?.("finalizing", hash);
  const receipt: any = await retried(() => reader().waitForTransactionReceipt({ hash, waitUntil: "finalized", interval: 4000, retries: 200, fullTransaction: true }), 4);
  if (!succeeded(receipt)) throw new WalletError("refused", `The deploy did not succeed: ${refusalOf(receipt) || "no detail"}`, hash);
  const address = findAddress(receipt);
  if (!address) throw new WalletError("no_address", "The deploy finalized but the receipt carries no contract address. Open it on the explorer.", hash);
  return { address, hash };
}

export function findAddress(node: any): string {
  if (node && typeof node === "object") {
    for (const key of ["contract_address", "contractAddress"]) {
      const v = node[key];
      if (typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v)) return v;
    }
    for (const v of Object.values(node)) {
      const hit = findAddress(v);
      if (hit) return hit;
    }
  }
  return "";
}
