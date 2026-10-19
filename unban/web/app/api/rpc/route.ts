import { RPC } from "@/lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Forwards the browser's JSON-RPC calls to Studio Next, which does not
 * reliably send CORS headers. It holds no key and signs nothing: a write
 * arrives here already signed, and the wallet's own signing never passes here.
 *
 * Only reading, estimating and sending signed transactions are forwarded.
 * Studio's administrative sim_ methods are refused (the faucet has its own
 * route with limits), so this cannot be used to reset or fund anything.
 */
const ALLOWED = /^(eth_|gen_|net_|web3_)|^sim_(call|estimate|get)/;

type Call = { method?: unknown };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const calls: Call[] = Array.isArray(body) ? body : [body];
  if (!body || calls.length === 0 || calls.length > 20) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } }, { status: 400 });
  }
  for (const call of calls) {
    const method = String(call?.method ?? "");
    if (!ALLOWED.test(method)) {
      return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32601, message: `method ${method} is not forwarded` } }, { status: 403 });
    }
  }
  const upstream = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32006, message: "Studio Next did not answer" } }, { status: 502 });
  }
  return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json" } });
}
