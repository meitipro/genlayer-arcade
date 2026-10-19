import { RPC } from "@/lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Test GEN for a visitor's wallet on Studio Next, through Studio's own
 * sim_fundAccount. No key is involved.
 *
 * Rule 30: the address is checksummed first (a lowercase one is answered with
 * a hash and funded with nothing), the amount goes as a decimal string, and
 * the RPC's answer is ignored. Success is the balance moving, read back.
 *
 * Limits live in this instance's memory, per address and per IP: they slow a
 * loop down rather than enforce anything across instances.
 */
const AMOUNT = (100n * 10n ** 18n).toString();
const PER_ADDRESS_MS = 10 * 60 * 1000;
// The /run page funds about twenty fresh test accounts in one sitting.
const PER_IP_WINDOW_MS = 10 * 60 * 1000;
const PER_IP_MAX = 40;
const lastByAddress = new Map<string, number>();
const recentByIp = new Map<string, number[]>();

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  return response.json();
}

async function balance(address: string): Promise<bigint> {
  try {
    return BigInt((await rpc("eth_getBalance", [address, "latest"]))?.result ?? "0x0");
  } catch {
    return 0n;
  }
}

export async function POST(request: Request) {
  const { getAddress } = await import("viem");
  const body = await request.json().catch(() => ({}));
  let address: string;
  try {
    address = getAddress(String((body as { address?: unknown }).address ?? ""));
  } catch {
    return Response.json({ message: "That is not a wallet address." }, { status: 400 });
  }
  const now = Date.now();
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const recent = (recentByIp.get(ip) ?? []).filter((t) => t > now - PER_IP_WINDOW_MS);
  const waitAddress = (lastByAddress.get(address) ?? 0) + PER_ADDRESS_MS - now;
  const waitIp = recent.length >= PER_IP_MAX ? recent[0] + PER_IP_WINDOW_MS - now : 0;
  const wait = Math.max(waitAddress, waitIp);
  if (wait > 0) {
    return Response.json({ message: `The faucet funded this wallet or connection recently. Try again in ${Math.ceil(wait / 1000)} seconds.` }, { status: 429 });
  }
  lastByAddress.set(address, now);
  recentByIp.set(ip, [...recent, now]);
  if (lastByAddress.size > 5000) lastByAddress.clear();
  if (recentByIp.size > 5000) recentByIp.clear();

  const before = await balance(address);
  try {
    await rpc("sim_fundAccount", [address, AMOUNT]);
  } catch {
    // the answer is not evidence either way
  }
  let after = before;
  for (let i = 0; i < 8 && after <= before; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    after = await balance(address);
  }
  if (after <= before) {
    lastByAddress.delete(address);
    recentByIp.set(ip, recent);
    return Response.json({ message: "Studio's faucet was asked, but the balance has not moved. Try again in a moment." }, { status: 502 });
  }
  return Response.json({ funded: true, before: before.toString(), after: after.toString() });
}
