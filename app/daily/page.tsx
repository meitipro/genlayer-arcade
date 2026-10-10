import type { Metadata } from "next";
import { DailyCard } from "@/components/DailyCard";
import { today } from "@/lib/daily";
import { ONCHAIN_GAMES } from "@/lib/games";
import type { OnchainGame } from "@/lib/onchain";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daily" };

export default async function Daily() {
  const rounds = await Promise.all(ONCHAIN_GAMES.map((g) => today(g.slug as OnchainGame)));
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-[28px] font-bold">Today&apos;s dailies</h1>
        <p className="max-w-2xl text-muted">
          Three games a day, each settled by an Intelligent Contract. New rounds open at 00:00 UTC. Oracle Guess locks at 18:00 UTC and resolves from the live source.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {ONCHAIN_GAMES.map((g, i) => (
          <DailyCard key={g.slug} game={g} round={rounds[i].round} error={rounds[i].error} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {ONCHAIN_GAMES.map((g) => (
          <div key={g.slug} className="card p-4 text-sm">
            <p className="font-semibold">{g.title}</p>
            <p className="mt-1 text-muted">{g.idea}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
