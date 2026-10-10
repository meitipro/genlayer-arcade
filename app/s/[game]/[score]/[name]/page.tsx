// Share card page: carries the dynamic OG image for one score, links back to the game.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { gameBySlug } from "@/lib/games";

type P = { params: Promise<{ game: string; score: string; name: string }> };

async function parse(params: P["params"]) {
  const { game, score, name } = await params;
  const g = gameBySlug(game);
  const n = Number(score);
  const who = decodeURIComponent(name);
  if (!g?.scoring || !Number.isInteger(n) || n < 0 || n > g.scoring.cap || !/^[a-zA-Z0-9_]{3,20}$/.test(who)) return null;
  return { g, n, who };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = await parse(params);
  if (!p) return {};
  const title = `${p.who} scored ${p.n.toLocaleString("en-US")} in ${p.g.title}`;
  const img = `/api/og/score/${p.g.slug}/${p.n}/${encodeURIComponent(p.who)}`;
  return {
    title,
    openGraph: { title, description: p.g.idea, images: [{ url: img, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, images: [img] },
  };
}

export default async function Share({ params }: P) {
  const p = await parse(params);
  if (!p) notFound();
  return (
    <div style={{ "--accent": p.g.accent } as CSSProperties} className="mx-auto max-w-xl space-y-5 px-4 py-16 text-center">
      <p className="mono text-xs uppercase tracking-widest text-accent">{p.g.title}</p>
      <h1 className="text-[28px] font-bold">
        {p.who} scored <span className="mono text-accent">{p.n.toLocaleString("en-US")}</span>
      </h1>
      <p className="text-muted">{p.g.idea}</p>
      <Link href={p.g.href} className="btn btn-primary">
        Beat it
      </Link>
      <p className="text-xs text-muted">Shared scores are what the player posted; the season boards show what the server accepted.</p>
    </div>
  );
}
