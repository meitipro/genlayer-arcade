// POST /api/rpc: a same-origin JSON-RPC relay to Studionet for wallet mode.
// The browser cannot call studio.genlayer.com directly from this domain (CORS),
// so read-only and fee methods are forwarded; anything that signs or spends
// stays in the visitor's wallet, and every other method is refused.
import { NextResponse } from "next/server";
import { clientIp, limits } from "@/lib/ratelimit";
import { STUDIONET } from "@/lib/wallet";

const ALLOWED = new Set([
  "eth_chainId",
  "net_version",
  "eth_blockNumber",
  "eth_gasPrice",
  "eth_estimateGas",
  "eth_getTransactionCount",
  "eth_getBalance",
  "eth_call",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "gen_call",
]);

export async function POST(req: Request) {
  if (!(await limits.rpc.limit(clientIp(req))).success)
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32029, message: "slow down" } }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.method !== "string" || !ALLOWED.has(body.method))
    return NextResponse.json({ jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32601, message: "method not relayed" } }, { status: 400 });
  const upstream = await fetch(STUDIONET.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, method: body.method, params: Array.isArray(body.params) ? body.params : [] }),
  });
  return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
