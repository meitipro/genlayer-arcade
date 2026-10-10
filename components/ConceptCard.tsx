import type { Game } from "@/lib/games";

/** "What you just played": one line about the GenLayer idea behind the game. */
export function ConceptCard({ game }: { game: Game }) {
  return (
    <aside className="card border-l-4 p-4" style={{ borderLeftColor: game.accent }}>
      <p className="mono text-xs uppercase text-muted">what you just played</p>
      <p className="mt-2 text-sm leading-relaxed">{game.concept}</p>
      <a href={game.learnMore} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline">
        Learn more in the GenLayer docs
      </a>
    </aside>
  );
}
