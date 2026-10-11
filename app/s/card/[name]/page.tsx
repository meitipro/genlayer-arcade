// Share page for a card: carries the card image for link previews, then sends
// a signed-in visitor on to the arcade.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cardFor } from "@/lib/card";
import { shareParts } from "@/lib/cardShare";

type P = { params: Promise<{ name: string }>; searchParams: Promise<{ v?: string }> };

const NAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const VERSION_RE = /^[a-zA-Z0-9-]{1,40}$/;

async function load(params: P["params"]) {
  const name = decodeURIComponent((await params).name);
  return NAME_RE.test(name) ? cardFor(name) : null;
}

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const card = await load(params);
  if (!card) return {};
  const v = (await searchParams).v;
  const img = `/api/og/card/${encodeURIComponent(card.name)}${v && VERSION_RE.test(v) ? `?v=${v}` : ""}`;
  const title = `${card.name} on GenLayer Arcade`;
  const description = shareParts(card, "").body;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: img, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}

export default async function ShareCard({ params }: P) {
  const card = await load(params);
  if (!card) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-14 text-center">
      <p className="mono text-xs uppercase tracking-widest text-accent">GenLayer Arcade credential</p>
      <h1 className="text-[28px] font-bold">{card.name}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated image, fixed size */}
      <img src={`/api/og/card/${encodeURIComponent(card.name)}`} alt={`Card of ${card.name}`} width={1200} height={630} className="mx-auto h-auto w-full rounded-[18px] border border-white/10" />
      <div className="flex justify-center gap-2">
        <Link href="/" className="btn btn-primary">
          Play the arcade
        </Link>
        <Link href="/card" className="btn btn-ghost">
          Get your card
        </Link>
      </div>
    </div>
  );
}
