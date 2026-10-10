// POST /api/admin/[action] with x-admin-token. open, close, lock, resolve per
// game; finalize-season; remove-score; rollover and deadline (the cron jobs,
// run by hand); tx (status of an admin write); log.
import { NextResponse } from "next/server";
import {
  adminLog,
  adminOk,
  adminTxStatus,
  closeRound,
  dailyRollover,
  finalizeSeason,
  lockOracle,
  openBridge,
  openOracle,
  openVerdict,
  oracleDeadline,
  removeScore,
  resolveOracle,
} from "@/lib/admin";
import { chainBusy } from "@/lib/daily";
import { gameBySlug } from "@/lib/games";
import { clientIp, limits } from "@/lib/ratelimit";
import { HASH_RE, RID_RE } from "@/lib/route-helpers";

export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  if (!(await limits.admin.limit(clientIp(req))).success) return NextResponse.json({ error: "slow down" }, { status: 429 });
  if (!adminOk(req)) return NextResponse.json({ error: "wrong admin token" }, { status: 401 });
  const { action } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, string | number | boolean | undefined>;
  const game = String(b.game ?? "");
  const rid = String(b.round ?? "");
  const str = (k: string) => (b[k] === undefined || b[k] === "" ? undefined : String(b[k]));
  const idx = b.index === undefined || b.index === "" ? undefined : Number(b.index);
  try {
    switch (action) {
      case "open":
        if (game === "verdict") return ok(await openVerdict({ challenge: str("challenge"), criteria: str("criteria"), index: idx }));
        if (game === "bridge") return ok(await openBridge({ start: str("start"), end: str("end"), index: idx }));
        if (game === "oracle")
          return ok(await openOracle({ question: str("question"), url: str("url"), path: str("path"), unit: str("unit"), index: idx }));
        return bad("open needs game verdict, bridge or oracle");
      case "close":
        if ((game !== "verdict" && game !== "bridge") || !RID_RE.test(rid)) return bad("close needs game verdict or bridge and a round");
        return ok(await closeRound(game, rid));
      case "lock":
        if (!RID_RE.test(rid)) return bad("lock needs a round");
        return ok(await lockOracle(rid));
      case "resolve":
        if (!RID_RE.test(rid)) return bad("resolve needs a round");
        return ok(await resolveOracle(rid));
      case "finalize-season": {
        const season = str("season");
        if (season && !/^\d{4}-W\d{2}$/.test(season)) return bad("season looks like 2026-W41");
        return NextResponse.json(await finalizeSeason(season, b.force === true));
      }
      case "remove-score": {
        const player = str("player") ?? "";
        if (!gameBySlug(game)?.scoring || !player) return bad("remove-score needs an arcade game and a player");
        return NextResponse.json({ removed: await removeScore(game, player, str("season")) });
      }
      case "rollover":
        return NextResponse.json({ sent: await dailyRollover() });
      case "deadline":
        return NextResponse.json({ sent: await oracleDeadline() });
      case "tx": {
        const hash = str("hash") ?? "";
        if (!HASH_RE.test(hash)) return bad("bad hash");
        const view = await adminTxStatus(hash as `0x${string}`);
        return view ? NextResponse.json(view) : NextResponse.json({ error: "unknown admin transaction" }, { status: 404 });
      }
      case "log":
        return NextResponse.json({ log: await adminLog() });
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 404 });
    }
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    return NextResponse.json({ error: /not deployed/.test(m) ? m : `not sent: ${chainBusy(e)}`, detail: m.slice(0, 300) }, { status: 503 });
  }
}

const ok = (sent: unknown) => NextResponse.json({ sent });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
