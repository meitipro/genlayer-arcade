"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MuteToggle } from "./MuteToggle";
import { AccountChip } from "./NicknameGate";

const NAV = [
  { href: "/games", label: "Games" },
  { href: "/daily", label: "Daily" },
  { href: "/leaderboard", label: "Boards" },
  { href: "/events", label: "Events" },
  { href: "/card", label: "My Card" },
];

export function Header() {
  // the login page is the only thing a signed-out visitor sees, so it has no menu
  const onLogin = usePathname() === "/login";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link href={onLogin ? "/login" : "/"} className="display shrink-0 text-[17px] font-bold tracking-tight sm:text-lg">
          GenLayer <span className="text-accent">Arcade</span>
        </Link>
        {!onLogin && (
          <nav aria-label="Main" className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-[10px] px-3 py-2 text-sm text-muted hover:bg-surface hover:text-text">
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!onLogin && <AccountChip />}
          <MuteToggle />
        </div>
      </div>
      {!onLogin && (
        <nav aria-label="Main mobile" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-[10px] px-3 py-2 text-sm text-muted hover:bg-surface hover:text-text">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
