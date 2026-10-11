// POST /api/daily/[game]/register {hash}: wallet mode. The visitor's wallet
// sent the submit transaction itself. The hub reads that transaction back from
// the chain and records it for status polling, XP and history only if it calls
// this game's submit method on this game's contract, for the round open now,
// under the name derived from the sending address.
import { abi } from "genlayer-js";
import { NextResponse } from "next/server";
import { addressFor, doneKey, getRound, latestRoundId, rememberTx, txKey } from "@/lib/daily";
import { readClient } from "@/lib/genlayer";
import { ONCHAIN, roundIsOpen } from "@/lib/onchain";
import { sessionPlayer } from "@/lib/auth";
import { playerKey } from "@/lib/player";
import { redis } from "@/lib/redis";
import { gameOr404, HASH_RE } from "@/lib/route-helpers";
import { walletName } from "@/lib/wallet";

export const maxDuration = 60;

type Tx = { from_address?: string; sender?: string; to_address?: string; recipient?: string; data?: { calldata?: { base64?: string } } };

export async function POST(req: Request, ctx: { params: Promise<{ game: string }> }) {
  const g = gameOr404((await ctx.params).game);
  if (g instanceof NextResponse) return g;
  const { hash } = (await req.json().catch(() => ({}))) as { hash?: string };
  if (!hash || !HASH_RE.test(hash)) return NextResponse.json({ error: "bad hash" }, { status: 400 });
  // the Discord account behind the wallet: recorded with the wallet player, never trusted from the body
  const owner = await sessionPlayer(req);
  if (!owner) return NextResponse.json({ error: "sign in with Discord first", gate: "discord" }, { status: 401 });
  const contract = addressFor(g);
  if (!contract) return NextResponse.json({ error: "contract not deployed" }, { status: 503 });

  let tx: Tx | null = null;
  for (let i = 0; i < 8 && !tx; i++) {
    try {
      tx = (await readClient.getTransaction({ hash: hash as never })) as unknown as Tx;
    } catch {
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  if (!tx) return NextResponse.json({ error: "transaction not found yet, try again in a moment" }, { status: 404 });
  const from = String(tx.from_address ?? tx.sender ?? "");
  const to = String(tx.to_address ?? tx.recipient ?? "");
  if (to.toLowerCase() !== contract.toLowerCase()) return NextResponse.json({ error: "that transaction is not for this game" }, { status: 400 });
  let method = "";
  let args: unknown[] = [];
  try {
    const b64 = tx.data?.calldata?.base64 ?? "";
    const decoded = abi.calldata.decode(Uint8Array.from(Buffer.from(b64, "base64"))) as Map<string, unknown>;
    method = String(decoded.get("method") ?? "");
    args = (decoded.get("args") as unknown[]) ?? [];
  } catch {
    return NextResponse.json({ error: "could not read the transaction call" }, { status: 400 });
  }
  const name = walletName(from);
  if (method !== ONCHAIN[g].submitFn || args[1] !== name)
    return NextResponse.json({ error: `the call must be ${ONCHAIN[g].submitFn} under ${name}, the name of the sending address` }, { status: 400 });
  const rid = String(args[0]);
  const latest = await latestRoundId(g);
  if (rid !== latest || !roundIsOpen(g, await getRound(g, rid))) return NextResponse.json({ error: "that round is not open" }, { status: 409 });

  // first registration wins; the contract itself refuses a second entry
  await redis.set(doneKey(g, rid, name), hash, { nx: true, ex: 7 * 86400 });
  if (await redis.set(`name:${name}`, name, { nx: true })) {
    await redis.hset(playerKey(name), { name, wallet: from, createdAt: Date.now(), xp: 0, owner });
  }
  if (!(await redis.hgetall(txKey(hash)))) await rememberTx(hash, { game: g, round: rid, player: name, createdAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, player: name, round: rid });
}
