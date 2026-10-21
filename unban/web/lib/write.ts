"use client";

/**
 * Writing to Unban from the visitor's own wallet. Nothing here holds a key:
 * every write is signed in the browser.
 *
 * The rules are the measured Studio Next ones (Recourse's lib/cycle.ts):
 *   - every write carries a fee deposit, estimated from Studio's simulation of
 *     the call, shown before signing; unused deposit comes back at finality;
 *   - a write Studio cannot simulate gets a flat 600/600 time-unit allocation;
 *   - withdraw pays at the root of its own allocation tree, so it carries one
 *     External node naming the caller as recipient;
 *   - a decided transaction is not a successful one: a refusal is decided
 *     too. Success is outcome accepted and execution FINISHED_WITH_RETURN.
 */

import {
  MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
  createClient,
  deriveExternalMessageCallKey,
  encodeExternalMessageFeeParams,
} from "genlayer-js";

import { chain, isTransient, retried } from "./chain";
import { CHAIN_HEX, CONTRACT, RPC, WALLET_CHAIN } from "./config";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function provider(): any {
  const eth = (globalThis as any).ethereum;
  if (!eth?.request) throw new Error("no_wallet");
  return eth;
}

function codeOf(error: any): number | undefined {
  return error?.code === -32603 ? error?.data?.originalError?.code ?? error?.data?.code : error?.code;
}

export async function connect(): Promise<string> {
  const accounts: string[] = await provider().request({ method: "eth_requestAccounts" });
  if (!accounts?.[0]) throw new Error("no_wallet");
  return accounts[0];
}

export async function switchNetwork(): Promise<void> {
  const eth = provider();
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (error) {
    if (codeOf(error) === 4902) await eth.request({ method: "wallet_addEthereumChain", params: [WALLET_CHAIN] });
    else throw error;
  }
}

async function rpc(method: string, params: unknown[]): Promise<any> {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  return response.json();
}

export async function balanceOf(address: string): Promise<bigint> {
  try {
    return BigInt((await rpc("eth_getBalance", [address, "latest"]))?.result ?? "0x0");
  } catch {
    return 0n;
  }
}

/**
 * Studio's faucet. The amount goes as a decimal string and the answer is
 * ignored: success is the balance moving, read back.
 */
export async function faucet(address: string, gen = 100): Promise<{ before: bigint; after: bigint }> {
  const before = await balanceOf(address);
  try {
    await rpc("sim_fundAccount", [address, (BigInt(gen) * 10n ** 18n).toString()]);
  } catch {
    /* judged by the balance below */
  }
  let after = before;
  for (let i = 0; i < 8 && after <= before; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    after = await balanceOf(address);
  }
  return { before, after };
}

function writer(address: string): any {
  return createClient({ chain, account: address as `0x${string}`, provider: provider() });
}

const FLAT = { leaderTimeunitsAllocation: 600n, validatorTimeunitsAllocation: 600n, rotations: [1n] };

export type Call = { functionName: string; args: unknown[]; value?: bigint };
export type Quote = { fees: any; feeValue: bigint };

/** The fee deposit for one call, before anything is signed. */
export async function quote(address: string, call: Call): Promise<Quote> {
  const client = writer(address);
  const value = call.value ?? 0n;
  if (call.functionName === "withdraw") {
    const node = {
      messageType: 0,
      onAcceptance: false,
      parentIndex: MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
      recipient: address,
      callKey: deriveExternalMessageCallKey("0x"),
      budget: 10n ** 15n,
      feeParams: encodeExternalMessageFeeParams({ gasLimit: 100000n, maxGasPrice: 10n ** 9n }),
    };
    const flat: any = await retried(() => client.estimateTransactionFees({ ...FLAT, messageAllocations: [node] }));
    return { fees: { distribution: flat.distribution, feeValue: flat.feeValue, messageAllocations: flat.messageAllocations ?? [node] }, feeValue: BigInt(flat.feeValue) };
  }
  let estimate: any;
  try {
    estimate = await retried(() =>
      client.estimateTransactionFeesForWrite({ address: CONTRACT, functionName: call.functionName, args: call.args, value }),
    );
  } catch (error) {
    if (isTransient(error)) throw error;
    estimate = await retried(() => client.estimateTransactionFees({ ...FLAT, totalMessageFees: 0n }));
  }
  const fees = {
    distribution: estimate.distribution,
    feeValue: estimate.feeValue,
    ...(estimate.messageAllocations?.length ? { messageAllocations: estimate.messageAllocations } : {}),
  };
  return { fees, feeValue: BigInt(estimate.feeValue) };
}

/** The sentence a contract refused with, out of either shape Studio sends it in. */
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

export class Refused extends Error {
  constructor(message: string, readonly hash: string) {
    super(message);
  }
}

/**
 * Sign with the quoted fees, report the hash the moment it exists, wait for
 * the committee's decision, and throw Refused with the contract's own
 * sentence when the decision is not a success.
 */
export async function send(address: string, call: Call, q: Quote, onHash?: (hash: string) => void): Promise<string> {
  const chainId = String(await provider().request({ method: "eth_chainId" })).toLowerCase();
  if (chainId !== CHAIN_HEX) throw new Error("wrong_network");
  const client = writer(address);
  const hash: string = await client.writeContract({
    address: CONTRACT,
    functionName: call.functionName,
    args: call.args,
    value: call.value ?? 0n,
    fees: q.fees,
  });
  onHash?.(hash);
  const receipt: any = await retried(
    () => client.waitForTransactionReceipt({ hash, waitUntil: "decided", interval: 3000, retries: 120, fullTransaction: true }),
    4,
  );
  const outcome = String(receipt?.lifecycle?.outcome ?? receipt?.statusName ?? "").toLowerCase();
  const execution = String(receipt?.txExecutionResultName ?? "");
  if (outcome !== "accepted" || execution !== "FINISHED_WITH_RETURN") {
    throw new Refused(refusalOf(receipt) || `${call.functionName} was not accepted (${outcome || "?"} ${execution})`.trim(), hash);
  }
  return hash;
}
