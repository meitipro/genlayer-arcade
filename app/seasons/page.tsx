// /seasons: the archive read from SeasonLedger, with explorer links.
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import type { CSSProperties } from "react";
import { addressUrl } from "@/lib/explorer";
import { gameBySlug } from "@/lib/games";
import { contractAddress, readRaw } from "@/lib/genlayer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seasons" };

type Row = { rank: number; player: string; score: number };

const archive = unstable_cache(
  async () => {
    const a = contractAddress("LEDGER_CONTRACT");
    if (!a) return null;
    const keys: string[] = JSON.parse((await readRaw(a, "list_seasons")) || "[]");
    const items = [];
    for (const key of keys.slice(-60).reverse()) {
      const raw = await readRaw(a, "get_season", [key]);
      items.push({ key, rows: raw ? (JSON.parse(raw) as Row[]) : [] });
    }
    return items;
  },
  ["seasons-archive"],
  { revalidate: 300, tags: ["seasons"] },
);

export default async function Seasons() {
  const ledger = contractAddress("LEDGER_CONTRACT");
  let items: { key: string; rows: Row[] }[] | null = null;
  let error = "";
  try {
    items = await archive();
  } catch {
    error = "could not read the SeasonLedger contract right now, try again in a minute";
  }
  const bySeason = new Map<string, { key: string; rows: Row[] }[]>();
  for (const it of items ?? []) {
    const season = it.key.split(":")[1] ?? "?";
    bySeason.set(season, [...(bySeason.get(season) ?? []), it]);
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-[28px] font-bold">Season archive</h1>
        <p className="max-w-2xl text-muted">
          Every Monday the top 10 of each arcade game is written to the SeasonLedger Intelligent Contract, so the champions stay verifiable. This page reads them back from the chain.
        </p>
        {ledger && (
          <a href={addressUrl(ledger)} target="_blank" rel="noreferrer" className="mono text-xs text-accent">
            SEASONLEDGER {ledger}
          </a>
        )}
      </div>
      {error && <p className="card p-4 text-sm text-danger">{error}</p>}
      {items && !items.length && <p className="card p-5 text-muted">No season has been recorded yet. The first one is written on Monday.</p>}
      {[...bySeason.entries()].map(([season, list]) => (
        <section key={season} className="space-y-3">
          <h2 className="mono text-lg">{season}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(({ key, rows }) => {
              const g = gameBySlug(key.split(":")[0]);
              return (
                <div key={key} className="card p-4" style={{ "--accent": g?.accent ?? "#9B7BFF" } as CSSProperties}>
                  <p className="mb-2 flex items-center gap-2 font-semibold">
                    <span className="dot" />
                    {g?.title ?? key}
                  </p>
                  <ol className="space-y-1 text-sm">
                    {rows.map((r) => (
                      <li key={r.player} className="flex gap-3">
                        <span className="mono w-5 text-muted">{r.rank}</span>
                        <span className="flex-1 truncate">{r.player}</span>
                        <span className="mono text-accent">{Number(r.score).toLocaleString("en-US")}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
