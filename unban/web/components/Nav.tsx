import Link from "next/link";

import { Wordmark } from "./Logo";
import { WalletButton } from "./Wallet";

const LINKS = [
  { href: "/courts", label: "Courts" },
  { href: "/rulings", label: "Rulings" },
  { href: "/mod", label: "For moderators" },
  { href: "/docs", label: "Docs" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[#0b0d12f2] backdrop-blur">
      <div className="wrap flex h-16 items-center gap-6">
        <Link href="/" aria-label="Unban home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-5 text-[14px] text-[var(--ink-2)] md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[var(--ink)]">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-[4px] border border-[var(--line-2)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink-2)] lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]" /> Studio Next
          </span>
          <WalletButton />
          <Link href="/new" className="btn small primary hidden sm:inline-flex">
            Open a court
          </Link>
        </div>
      </div>
      <nav className="wrap flex gap-4 pb-3 text-[13px] text-[var(--ink-2)] md:hidden">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
        <Link href="/new" className="text-[var(--amber)]">
          Open a court
        </Link>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--line)]">
      <div className="wrap grid gap-8 py-10 text-[14px] text-[var(--ink-2)] sm:grid-cols-3">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-[13px] text-[var(--ink-3)]">
            Ban appeals, decided by the community&apos;s own rules. On GenLayer Studio Next, chain 61997.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Product</span>
          <Link href="/courts">Courts</Link>
          <Link href="/rulings">Rulings</Link>
          <Link href="/new">Open a court</Link>
          <Link href="/mod">Moderator desk</Link>
        </div>
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Build</span>
          <Link href="/docs">Docs</Link>
          <Link href="/docs/reference/contract">Contract reference</Link>
          <Link href="/docs/more/judge-prompt">The judge prompt</Link>
          <a href="https://github.com/meitipro/genlayer-unban" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
