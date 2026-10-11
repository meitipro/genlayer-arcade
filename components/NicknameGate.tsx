"use client";
// The account on this site is a Discord account. These are the pieces that
// show it: a gate for anything that needs a signed-in player (the middleware
// already keeps signed-out visitors off every page, so this is the backstop for
// a session that ends while a page is open), and the account chip in the header.
import Link from "next/link";
import { type ReactNode } from "react";
import { loginUrl, signOut, usePlayer } from "@/lib/client/player";

export function SignInGate({ children, why = "Sign in with Discord to continue." }: { children?: ReactNode; why?: string }) {
  const p = usePlayer();
  if (p === undefined) return <div className="card h-40 animate-pulse" aria-busy />;
  if (p) return <>{children}</>;
  return (
    <div className="card space-y-3 p-5">
      <h2 className="text-lg font-semibold">Sign in with Discord</h2>
      <p className="text-sm text-muted">{why}</p>
      <a className="btn btn-primary" href={loginUrl()}>
        Continue with Discord
      </a>
    </div>
  );
}

export function AccountChip() {
  const p = usePlayer();
  if (!p) return null;
  return (
    <div className="flex items-center gap-1">
      <Link href="/card" className="pill mono max-w-[10rem] truncate hover:border-accent" title="My Card">
        {p.discord?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar
          <img src={p.discord.avatar} alt="" width={16} height={16} className="h-4 w-4 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="dot" />
        )}
        <span className="truncate">{p.name}</span>
      </Link>
      <button type="button" onClick={() => void signOut()} className="rounded-[10px] px-2 py-2 text-xs text-muted hover:text-text" aria-label="Sign out">
        Sign out
      </button>
    </div>
  );
}
