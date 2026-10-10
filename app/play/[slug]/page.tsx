import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameShell } from "@/components/GameShell";
import { ARCADE, gameBySlug } from "@/lib/games";

export function generateStaticParams() {
  return ARCADE.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = gameBySlug((await params).slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.blurb,
    openGraph: { images: [{ url: `/api/og/game/${g.slug}`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [`/api/og/game/${g.slug}`] },
  };
}

export default async function Play({ params }: { params: Promise<{ slug: string }> }) {
  const g = gameBySlug((await params).slug);
  if (!g || g.type !== "arcade") notFound();
  return <GameShell game={g} />;
}
