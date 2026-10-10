// Shared bits for the /api/daily/[game]/* routes.
import "server-only";
import { NextResponse } from "next/server";
import { isOnchain, type OnchainGame } from "./onchain";

export function gameOr404(game: string): OnchainGame | NextResponse {
  return isOnchain(game) ? game : NextResponse.json({ error: "no such daily game" }, { status: 404 });
}

export const RID_RE = /^[1-9][0-9]{0,8}$/;
export const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
