// The player card: Discord identity and GenLayer server roles, the tier those
// roles give, verified X and GitHub, and arcade standing. The tier sets the
// card's one accent.
import type { CSSProperties } from "react";
import type { PlayerCard as Card } from "@/lib/card";

function Avatar({ src, alt }: { src: string | null | undefined; alt: string }) {
  if (!src) return <div className="grid h-20 w-20 place-items-center rounded-2xl bg-raised font-mono text-2xl text-muted">{alt.slice(0, 2).toUpperCase()}</div>;
  // eslint-disable-next-line @next/next/no-img-element -- remote avatars from Discord, GitHub and X CDNs
  return <img src={src} alt={alt} width={80} height={80} className="h-20 w-20 rounded-2xl object-cover" referrerPolicy="no-referrer" />;
}

export function PlayerCardView({ card }: { card: Card }) {
  const tier = card.discord?.tier;
  const accent = tier?.color ?? "#9B7BFF";
  return (
    <article
      style={{ "--accent": accent } as CSSProperties}
      className="relative overflow-hidden rounded-[20px] border border-line bg-surface p-5 sm:p-6"
      aria-label={`${card.name}'s card`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-2xl" style={{ background: accent }} aria-hidden />
      <div className="flex items-start gap-4">
        <Avatar src={card.discord?.avatar ?? card.github?.avatar ?? card.x?.avatar} alt={card.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="mono text-xs uppercase tracking-widest text-accent">genlayer arcade card</p>
          <h2 className="mono truncate text-2xl font-semibold">{card.name}</h2>
          {card.discord ? (
            <p className="truncate text-sm text-muted">
              Discord <span className="text-text">{card.discord.username}</span>
              {card.discord.joinedAt && <> · in the GenLayer server since {card.discord.joinedAt.slice(0, 10)}</>}
            </p>
          ) : (
            <p className="text-sm text-muted">Discord not connected</p>
          )}
        </div>
        {tier && (
          <div className="text-right">
            <p className="mono text-3xl font-semibold text-accent">{tier.n}</p>
            <p className="mono text-xs uppercase text-muted">{tier.name}</p>
          </div>
        )}
      </div>

      {card.discord && (
        <div className="mt-5 space-y-2">
          <p className="mono text-xs uppercase text-muted">
            {card.discord.isMember ? <>highest role <span className="text-accent">{card.discord.highestRole}</span></> : "not a member of the GenLayer Discord server"}
          </p>
          {card.discord.roles.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="GenLayer Discord roles">
              {card.discord.roles.map((r, i) => (
                <li key={r} className={`pill mono ${i === 0 ? "border-accent text-text" : "text-muted"}`}>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <dl className="mono mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ["level", String(card.level)],
          ["xp", card.xp.toLocaleString("en-US")],
          ["badges", `${card.badges}/10`],
          ["dailies", String(card.dailies)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-raised/60 p-2">
            <dt className="text-xs uppercase text-muted">{k}</dt>
            <dd className="text-lg text-accent">{v}</dd>
          </div>
        ))}
      </dl>
      {card.best && (
        <p className="mono mt-3 text-xs text-muted">
          best run <span className="text-text">{card.best.score.toLocaleString("en-US")}</span> in {card.best.title}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        {card.x && (
          <a href={card.x.url} target="_blank" rel="noreferrer" className="pill hover:border-accent">
            <span className="mono text-xs text-muted">X</span> @{card.x.handle}
            {card.x.followers !== null && <span className="mono text-xs text-muted">{card.x.followers.toLocaleString("en-US")} followers</span>}
          </a>
        )}
        {card.github && (
          <a href={card.github.url} target="_blank" rel="noreferrer" className="pill hover:border-accent">
            <span className="mono text-xs text-muted">GitHub</span> {card.github.handle}
            {card.github.followers !== null && <span className="mono text-xs text-muted">{card.github.followers.toLocaleString("en-US")} followers</span>}
          </a>
        )}
        {card.wallet && <span className="pill mono text-xs text-muted">wallet {card.wallet.slice(0, 6)}...{card.wallet.slice(-4)}</span>}
      </div>
      <p className="mono mt-4 text-[11px] text-muted">
        roles read from Discord when connected · handles verified by a code in the profile bio{card.since ? ` · player since ${card.since}` : ""}
      </p>
    </article>
  );
}
