// POST /api/score (section 8): token valid and unused, player secret valid,
// score <= cap, elapsed >= minMs, score <= elapsed x maxPerSec. 30/min/IP.
import { NextResponse } from "next/server";
import { eventBoardKey, eventById, GRACE_MS } from "@/lib/events";
import { GAMES } from "@/lib/games";
import { playerKey, verifyPlayer } from "@/lib/player";
import { ratelimit, clientIp } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";
import { seasonId } from "@/lib/season";
import { verifySession } from "@/lib/session";
import { afterArcadeRun } from "@/lib/xp";

export async function POST(req: Request) {
  if (!(await ratelimit.limit(`score:${clientIp(req)}`)).success)
    return NextResponse.json({ error: "slow down" }, { status: 429 });

  const { token, player, playerSecret, score, stats } = await req.json().catch(() => ({}));
  const s = verifySession(token);
  if (!s) return NextResponse.json({ error: "bad session" }, { status: 400 });

  const game = GAMES.find((g) => g.slug === s.game);
  if (!game?.scoring) return NextResponse.json({ error: "no game" }, { status: 400 });

  // nickname ownership: hash of secret stored at claim time
  const name = await verifyPlayer(player, playerSecret);
  if (!name) return NextResponse.json({ error: "bad player" }, { status: 401 });

  // one score per session
  if (!(await redis.set(`session:used:${s.sid}`, 1, { nx: true, ex: 7200 })))
    return NextResponse.json({ error: "session used" }, { status: 409 });

  const ms = Date.now() - s.t;
  const { maxPerSec, minMs, cap } = game.scoring;
  const n = Math.floor(Number(score));
  if (!Number.isFinite(n) || n < 0 || n > cap || ms < minMs || ms > 2 * 3600 * 1000 || n > (ms / 1000) * maxPerSec)
    return NextResponse.json({ error: "implausible score" }, { status: 422 });

  const season = seasonId();
  await redis.zaddGt(`lb:${game.slug}:${season}`, { score: n, member: name });
  await redis.zaddGt(`lb:${game.slug}:all`, { score: n, member: name });
  await redis.hincrby(playerKey(name), `plays:${game.slug}`, 1);
  const [best, rank] = await Promise.all([
    redis.zscore(`lb:${game.slug}:${season}`, name),
    redis.zrevrank(`lb:${game.slug}:${season}`, name),
  ]);
  // tournament mode: the event board, if the run started in a live event's room
  let event: { id: string; rank: number | null } | null = null;
  if (s.room) {
    const ev = await eventById(s.room);
    if (ev && ev.game === game.slug && s.t >= Date.parse(ev.startsAt) - 60000 && Date.now() <= Date.parse(ev.endsAt) + GRACE_MS) {
      await redis.zaddGt(eventBoardKey(ev.id), { score: n, member: name });
      const r = await redis.zrevrank(eventBoardKey(ev.id), name);
      event = { id: ev.id, rank: r === null ? null : r + 1 };
    }
  }
  const progress = await afterArcadeRun(name, game.slug, n, stats && typeof stats === "object" ? stats : {});
  return NextResponse.json({ ok: true, season, best, rank: rank === null ? null : rank + 1, xp: progress.xp, badges: progress.fresh, event });
}
