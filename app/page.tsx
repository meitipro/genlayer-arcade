import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import events from "@/data/events.json";
import { Cover } from "@/components/Cover";
import { DailyCard } from "@/components/DailyCard";
import { getBoard, latestRoundId, today } from "@/lib/daily";
import { ARCADE, CORE_ARCADE, gameBySlug, ONCHAIN_GAMES } from "@/lib/games";
import type { BridgeEntry, OnchainGame, VerdictEntry } from "@/lib/onchain";
import { redis } from "@/lib/redis";
import { formatLeft, seasonEnd, seasonId } from "@/lib/season";

export const dynamic = "force-dynamic";

async function yesterdayTop(game: "verdict" | "bridge") {
  try {
    const rid = await latestRoundId(game);
    if (!rid || rid === "1") return null;
    const prev = String(Number(rid) - 1);
    const rows = (await getBoard(game, prev)) as (VerdictEntry | BridgeEntry)[];
    return { round: prev, rows: rows.slice(0, 3) };
  } catch {
    return null;
  }
}

async function LiveDailies() {
  const [dailies, yVerdict, yBridge] = await Promise.all([
    Promise.all(ONCHAIN_GAMES.map((g) => today(g.slug as OnchainGame))),
    yesterdayTop("verdict"),
    yesterdayTop("bridge"),
  ]);
  return (
      <section aria-labelledby="dailies" className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 id="dailies" className="text-xl font-semibold">
            Today on-chain
          </h2>
          <Link href="/daily" className="text-sm text-muted hover:text-text">
            All dailies
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {ONCHAIN_GAMES.map((g, i) => (
            <DailyCard key={g.slug} game={g} round={dailies[i].round} error={dailies[i].error} />
          ))}
        </div>
        {(yVerdict?.rows.length || yBridge?.rows.length) ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { y: yVerdict, g: gameBySlug("verdict")! },
              { y: yBridge, g: gameBySlug("bridge")! },
            ]
              .filter((x) => x.y && x.y.rows.length)
              .map(({ y, g }) => (
                <div key={g.slug} className="card p-4" style={{ "--accent": g.accent } as CSSProperties}>
                  <p className="mono mb-2 text-xs uppercase text-muted">
                    yesterday · {g.title} #{y!.round} · top 3
                  </p>
                  <ol className="space-y-1 text-sm">
                    {y!.rows.map((r, i) => (
                      <li key={r.player} className="flex gap-3">
                        <span className="mono w-4 text-muted">{i + 1}</span>
                        <Link href={`/p/${r.player}`} className="flex-1 truncate hover:text-accent">
                          {r.player}
                        </Link>
                        <span className="mono text-accent">{r.score}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
          </div>
        ) : null}
      </section>
  );
}

async function SeasonStrip() {
  const season = seasonId();
  const tops = await Promise.all(ARCADE.map((g) => redis.ztop(`lb:${g.slug}:${season}`, 3)));
  return (
      <section aria-labelledby="season" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="season" className="text-xl font-semibold">
            Season {season}
          </h2>
          <span className="mono text-sm text-muted">season ends in {formatLeft(seasonEnd().getTime() - Date.now())}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ARCADE.map((g, i) => (
            <Link key={g.slug} href={`/leaderboard?game=${g.slug}`} className="card p-4 hover:border-accent" style={{ "--accent": g.accent } as CSSProperties}>
              <div className="mb-2 flex items-center gap-2">
                <span className="dot" />
                <span className="font-semibold">{g.title}</span>
              </div>
              {tops[i].length ? (
                <ol className="space-y-1 text-sm">
                  {tops[i].map((r, k) => (
                    <li key={r.member} className="flex gap-3">
                      <span className="mono w-4 text-muted">{k + 1}</span>
                      <span className="flex-1 truncate">{r.member}</span>
                      <span className="mono text-accent">{r.score.toLocaleString("en-US")}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">No scores yet this season.</p>
              )}
            </Link>
          ))}
        </div>
      </section>
  );
}

function Skeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <section className="space-y-4" aria-busy>
      <h2 className="text-xl font-semibold">{label}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: rows * 3 }).map((_, i) => (
          <div key={i} className="card h-32 animate-pulse" />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const week = Math.floor(Date.now() / (7 * 86400000));
  const featured = CORE_ARCADE[week % CORE_ARCADE.length];
  const upcoming = (events as { id: string; title: string; startsAt: string; roomCode: string }[]).filter((e) => new Date(e.startsAt).getTime() > Date.now());
  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
      <section className="space-y-5">
        <p className="mono text-xs uppercase tracking-widest text-accent">community gaming hub</p>
        <h1 className="max-w-3xl text-[44px] font-bold leading-[1.05] sm:text-[64px]">Play, compete, get judged by consensus.</h1>
        <p className="max-w-2xl text-muted">
          Fourteen games built around how GenLayer works. Arcade scores are instant. Three daily games are settled on-chain by Intelligent Contracts, with an explorer link on every result.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/games" className="btn btn-primary">
            Play now
          </Link>
          <Link href="/daily" className="btn btn-ghost">
            Today&apos;s dailies
          </Link>
        </div>
      </section>

      <Suspense fallback={<Skeleton label="Today on-chain" rows={1} />}>
        <LiveDailies />
      </Suspense>

      <section aria-labelledby="featured" className="grid items-center gap-6 md:grid-cols-[3fr_2fr]" style={{ "--accent": featured.accent } as CSSProperties}>
        <Link href={featured.href} className="card block overflow-hidden hover:border-accent">
          <Cover game={featured} className="block aspect-video w-full" />
        </Link>
        <div className="space-y-3">
          <p className="mono text-xs uppercase tracking-widest text-accent">featured this week</p>
          <h2 id="featured" className="text-[28px] font-bold">
            {featured.title}
          </h2>
          <p className="text-muted">{featured.blurb}</p>
          <p className="text-sm">{featured.idea}</p>
          <Link href={featured.href} className="btn btn-primary">
            Play {featured.title}
          </Link>
        </div>
      </section>

      <Suspense fallback={<Skeleton label="Season" rows={2} />}>
        <SeasonStrip />
      </Suspense>

      <section className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <div className="card space-y-2 p-5">
          <p className="mono text-xs uppercase text-muted">next event</p>
          {upcoming.length ? (
            <>
              <p className="font-semibold">{upcoming[0].title}</p>
              <p className="mono text-sm text-muted">{new Date(upcoming[0].startsAt).toUTCString().replace(":00 GMT", " UTC")}</p>
              <p className="mono text-sm">room code {upcoming[0].roomCode}</p>
            </>
          ) : (
            <p className="text-sm text-muted">No event scheduled yet. Tournaments are announced in the GenLayer Discord.</p>
          )}
          <Link href="/events" className="text-sm text-accent">
            Events
          </Link>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">How GenLayer powers this</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              ["You submit", "Your daily entry is sent to an Intelligent Contract. The hub pays the fee, so no wallet is needed."],
              ["Validators judge", "A leader runs the LLM or fetches the live web, and every validator does it again on its own."],
              ["Consensus lands", "The result is only recorded when they agree. Every result links to the explorer."],
            ].map(([t, d], i) => (
              <li key={t} className="space-y-1">
                <p className="mono text-xs text-accent">0{i + 1}</p>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
