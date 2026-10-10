// Profile: name, level, XP bar, best score and season rank per game, badges, daily history.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { DeviceSecret } from "@/components/DeviceSecret";
import { historyOf } from "@/lib/daily";
import { txUrl } from "@/lib/explorer";
import { ARCADE, gameBySlug } from "@/lib/games";
import { canonicalName, playerKey } from "@/lib/player";
import { redis } from "@/lib/redis";
import { seasonId } from "@/lib/season";
import { BADGES, badgesOf, levelFor } from "@/lib/xp";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).name) };
}

export default async function Profile({ params }: { params: Promise<{ name: string }> }) {
  const name = await canonicalName(decodeURIComponent((await params).name));
  if (!name) notFound();
  const season = seasonId();
  const [p, badges, history, bests] = await Promise.all([
    redis.hgetall<Record<string, string>>(playerKey(name)),
    badgesOf(name),
    historyOf(name),
    Promise.all(
      ARCADE.map(async (g) => {
        const [all, sea, rank] = await Promise.all([
          redis.zscore(`lb:${g.slug}:all`, name),
          redis.zscore(`lb:${g.slug}:${season}`, name),
          redis.zrevrank(`lb:${g.slug}:${season}`, name),
        ]);
        return { g, all, sea, rank: rank === null ? null : rank + 1 };
      }),
    ),
  ]);
  const xp = Number(p?.xp ?? 0);
  const lv = levelFor(xp);
  const pct = Math.min(100, Math.round(((xp - lv.prev) / Math.max(1, lv.next - lv.prev)) * 100));
  const since = p?.createdAt ? new Date(Number(p.createdAt)).toISOString().slice(0, 10) : "";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <section className="space-y-3">
        <h1 className="mono text-[28px] font-semibold">{name}</h1>
        <p className="mono text-sm text-muted">
          level {lv.level} · {xp.toLocaleString("en-US")} XP{since ? ` · since ${since}` : ""}
        </p>
        <div className="h-2 max-w-md overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="XP to next level">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <p className="mono text-xs text-muted">
          {lv.next - xp} XP to level {lv.level + 1}
        </p>
        <DeviceSecret name={name} />
      </section>

      <section aria-labelledby="bests" className="space-y-3">
        <h2 id="bests" className="text-xl font-semibold">
          Best scores
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bests.map(({ g, all, sea, rank }) => (
            <Link key={g.slug} href={g.href} className="card p-4 hover:border-accent" style={{ "--accent": g.accent } as CSSProperties}>
              <p className="flex items-center gap-2 font-semibold">
                <span className="dot" />
                {g.title}
              </p>
              <p className="mono mt-2 text-2xl text-accent">{all === null ? "--" : all.toLocaleString("en-US")}</p>
              <p className="mono text-xs text-muted">
                this season {sea === null ? "--" : sea.toLocaleString("en-US")} · rank {rank ? `#${rank}` : "--"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="badges" className="space-y-3">
        <h2 id="badges" className="text-xl font-semibold">
          Badges <span className="mono text-sm text-muted">{badges.length}/10</span>
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BADGES.map((b) => {
            const has = badges.includes(b.id);
            return (
              <li key={b.id} className={`card p-3 ${has ? "border-accent" : "opacity-50"}`}>
                <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2l8 10-8 10-8-10z" fill={has ? "var(--accent)" : "none"} stroke={has ? "var(--accent)" : "var(--muted)"} strokeWidth="2" />
                </svg>
                <p className="mt-2 text-sm font-semibold">{b.name}</p>
                <p className="text-xs text-muted">{b.rule}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="text-xl font-semibold">
          Daily history
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">No daily games yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => {
              const g = gameBySlug(h.game);
              return (
                <li key={h.hash} className="card flex flex-wrap items-center gap-3 p-3 text-sm" style={{ "--accent": g?.accent ?? "#9B7BFF" } as CSSProperties}>
                  <span className="dot" />
                  <Link href={`/daily/${h.game}/${h.round}`} className="hover:text-accent">
                    {g?.title} #{h.round}
                  </Link>
                  <span className={`mono text-xs ${h.ok ? "text-accent" : "text-danger"}`}>{h.status}</span>
                  {h.ok && h.score !== undefined && <span className="mono text-xs">{h.game === "verdict" ? `${h.score}/10` : `score ${h.score}`}</span>}
                  {!h.ok && h.error && <span className="text-xs text-muted">{h.error}</span>}
                  <a href={txUrl(h.hash)} target="_blank" rel="noreferrer" className="mono ml-auto text-xs text-accent">
                    EXPLORER
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
