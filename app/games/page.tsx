import type { Metadata } from "next";
import Link from "next/link";
import { GameCard } from "@/components/GameCard";
import { CommunityList } from "@/components/CommunityList";
import { GAMES } from "@/lib/games";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Games" };

const TABS = [
  { id: "all", label: "All" },
  { id: "arcade", label: "Arcade" },
  { id: "onchain", label: "On-chain" },
  { id: "community", label: "Community" },
];

export default async function Games({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const asked = (await searchParams).tab;
  const tab = TABS.some((t) => t.id === asked) ? asked! : "all";
  const list = tab === "all" ? GAMES : GAMES.filter((g) => g.type === tab);
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-[28px] font-bold">Games</h1>
      <nav aria-label="Game types" className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "all" ? "/games" : `/games?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm ${tab === t.id ? "border-accent text-text" : "border-line text-muted hover:text-text"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "community" ? (
        <CommunityList />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => (
            <GameCard key={g.slug} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
