import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { ARCADE, gameBySlug } from "@/lib/games";

export const metadata: Metadata = { title: "Boards" };

export default async function Boards({ searchParams }: { searchParams: Promise<{ game?: string; scope?: string }> }) {
  const sp = await searchParams;
  const g = gameBySlug(sp.game ?? "")?.scoring ? gameBySlug(sp.game!)! : ARCADE[0];
  const scope = sp.scope === "all" ? "all" : "season";
  return (
    <div style={{ "--accent": g.accent } as CSSProperties} className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-[28px] font-bold">Boards</h1>
      <nav aria-label="Game" className="flex gap-2 overflow-x-auto pb-1">
        {ARCADE.map((x) => (
          <Link
            key={x.slug}
            href={`/leaderboard?game=${x.slug}&scope=${scope}`}
            aria-current={x.slug === g.slug ? "page" : undefined}
            style={{ "--accent": x.accent } as CSSProperties}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm ${x.slug === g.slug ? "border-accent" : "border-line text-muted hover:text-text"}`}
          >
            <span className="dot" />
            {x.title}
          </Link>
        ))}
      </nav>
      <div className="inline-flex rounded-[10px] border border-line p-1" role="group" aria-label="Scope">
        {(["season", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/leaderboard?game=${g.slug}&scope=${s}`}
            aria-current={scope === s ? "page" : undefined}
            className={`rounded-[8px] px-4 py-2 text-sm ${scope === s ? "bg-raised text-text" : "text-muted hover:text-text"}`}
          >
            {s === "season" ? "Season" : "All-time"}
          </Link>
        ))}
      </div>
      <Leaderboard key={`${g.slug}-${scope}`} game={g.slug} scope={scope} size={50} title={`${g.title} · ${scope === "all" ? "all-time" : "this season"}`} />
      <p className="text-sm text-muted">
        Seasons are ISO weeks in UTC, Monday to Sunday. Every Monday the top 10 of each game is written to the SeasonLedger contract. <Link href="/seasons" className="text-accent">Season archive</Link>
      </p>
    </div>
  );
}
