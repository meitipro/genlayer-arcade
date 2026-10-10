import Link from "next/link";
import type { CSSProperties } from "react";
import type { Game } from "@/lib/games";
import { Cover } from "./Cover";

export function GameCard({ game }: { game: Game }) {
  return (
    <Link
      href={game.href}
      style={{ "--accent": game.accent } as CSSProperties}
      className="card group block overflow-hidden hover:border-accent"
    >
      <Cover game={game} className="block aspect-video w-full" />
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <span className="dot" />
          <h3 className="font-semibold">{game.title}</h3>
          <span className="mono ml-auto text-xs uppercase text-muted">{game.type === "onchain" ? "on-chain" : game.type}</span>
        </div>
        <p className="text-sm text-muted">{game.blurb}</p>
      </div>
    </Link>
  );
}
