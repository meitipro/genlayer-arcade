// GET /api/discord/callback?code&state: Discord sends the player back here.
// The code is exchanged once, the user and their GenLayer server roles are
// read, the access token is dropped, and the account is linked to the nickname
// that started the flow. Always redirects to /card with an outcome.
import { NextResponse } from "next/server";
import { exchangeCode, fetchStanding, linkDiscord } from "@/lib/discord";
import { redis } from "@/lib/redis";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const back = (outcome: string) => NextResponse.redirect(new URL(`/card?discord=${outcome}`, u.origin));
  if (u.searchParams.get("error")) return back("cancelled");
  const state = u.searchParams.get("state") ?? "";
  const code = u.searchParams.get("code") ?? "";
  if (!state || !code) return back("bad-request");
  const name = await redis.get<string>(`discord:state:${state}`);
  if (!name) return back("expired");
  await redis.del(`discord:state:${state}`);
  try {
    const token = await exchangeCode(code, u.origin);
    const card = await fetchStanding(token);
    const linked = await linkDiscord(name, card);
    return back(linked.ok ? (card.isMember ? "ok" : "not-member") : linked.error);
  } catch (e) {
    console.error("discord callback failed", String((e as Error)?.message ?? e).slice(0, 200));
    return back("failed");
  }
}
