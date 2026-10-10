"use client";
// Wallet mode in the browser: connect, switch to Studionet, get test GEN, and
// send a daily submit from the visitor's own address. The wallet signs; every
// other RPC call goes through the same-origin /api/rpc relay (CORS).
import deployment from "@/lib/deployment.json";
import { ONCHAIN, type OnchainGame } from "@/lib/onchain";
import { STUDIONET } from "@/lib/wallet";

type Eth = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

export function eth(): Eth | null {
  return typeof window !== "undefined" ? ((window as unknown as { ethereum?: Eth }).ethereum ?? null) : null;
}

export async function connectWallet(): Promise<string> {
  const p = eth();
  if (!p) throw new Error("no wallet found in this browser");
  const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.length) throw new Error("the wallet shared no account");
  return accounts[0];
}

export async function onStudionet(): Promise<boolean> {
  const p = eth();
  if (!p) return false;
  return String(await p.request({ method: "eth_chainId" })).toLowerCase() === STUDIONET.chainIdHex;
}

export async function switchToStudionet(): Promise<void> {
  const p = eth();
  if (!p) throw new Error("no wallet found in this browser");
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIONET.chainIdHex }] });
  } catch (e) {
    if ((e as { code?: number })?.code !== 4902) throw e;
    await p.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: STUDIONET.chainIdHex,
          chainName: STUDIONET.chainName,
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          rpcUrls: [STUDIONET.rpc],
          blockExplorerUrls: [STUDIONET.explorer],
        },
      ],
    });
  }
}

export async function fundWallet(address: string): Promise<string | null> {
  const r = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
  const d = await r.json().catch(() => ({}));
  return r.ok ? null : (d.error ?? "the faucet did not answer");
}

/** Sends <game>.submit from the wallet and returns the transaction hash. */
export async function sendFromWallet(game: OnchainGame, address: string, args: unknown[]): Promise<`0x${string}`> {
  const contract = (deployment.contracts as Record<string, string>)[ONCHAIN[game].env];
  if (!contract) throw new Error("this game's contract is not deployed");
  const [{ createClient }, { studionet }] = await Promise.all([import("genlayer-js"), import("genlayer-js/chains")]);
  const proxy = `${window.location.origin}/api/rpc`;
  // a deep copy: createClient writes the endpoint into the chain object it is given
  const chain = { ...studionet, rpcUrls: { default: { http: [proxy] } } };
  const client = createClient({ chain, account: address as `0x${string}`, provider: eth() as never, endpoint: proxy });
  const hash = await client.writeContract({ address: contract as `0x${string}`, functionName: ONCHAIN[game].submitFn, args: args as never, value: BigInt(0) });
  return hash as `0x${string}`;
}
