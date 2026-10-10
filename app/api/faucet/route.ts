// POST /api/faucet {address}: test GEN from Studionet's built-in faucet for
// wallet mode. One per address every 10 minutes, five per network per hour.
// sim_fundAccount needs a checksummed address: a lowercase one returns a hash
// and funds nothing.
import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { readClient } from "@/lib/genlayer";
import { clientIp, limits } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b?.address !== "string" || !isAddress(b.address)) return NextResponse.json({ error: "not an address" }, { status: 400 });
  const address = getAddress(b.address);
  if (!(await redis.set(`faucet:${address.toLowerCase()}`, 1, { nx: true, ex: 600 })))
    return NextResponse.json({ error: "this address was funded in the last 10 minutes" }, { status: 429 });
  if (!(await limits.faucet.limit(clientIp(req))).success) return NextResponse.json({ error: "faucet limit reached for this network, try later" }, { status: 429 });
  try {
    await readClient.request({ method: "sim_fundAccount" as never, params: [address, 10 * 10 ** 18] as never });
    return NextResponse.json({ ok: true, address });
  } catch (e) {
    await redis.del(`faucet:${address.toLowerCase()}`);
    return NextResponse.json({ error: "the faucet did not answer, try again in a minute", detail: String((e as Error)?.message ?? e).slice(0, 160) }, { status: 503 });
  }
}
