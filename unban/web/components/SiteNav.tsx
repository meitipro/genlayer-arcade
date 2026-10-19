import Link from "next/link";

import { Wordmark } from "./Logo";
import { WalletButton } from "./Wallet";

const LINKS = [
  { href: "/courts", label: "Courts" },
  { href: "/rulings", label: "Rulings" },
  { href: "/mod", label: "For moderators" },
  { href: "/docs", label: "Docs" },
];

export function SiteNav() {
  return (
    <header style={{ borderBottom: "1px solid var(--line)", position: "sticky", top: 0, background: "rgba(11,13,18,.92)", backdropFilter: "blur(6px)", zIndex: 20 }}>
      <div className="wrap" style={{ display: "flex", alignItems: "center", gap: 20, minHeight: 60, flexWrap: "wrap", paddingTop: 8, paddingBottom: 8 }}>
        <Link href="/" aria-label="Unban home" style={{ textDecoration: "none" }}>
          <Wordmark />
        </Link>
        <nav style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 14 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="muted" style={{ textDecoration: "none" }}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="pill"><span className="dot" />Studio Next</span>
          <WalletButton />
          <Link href="/new" className="btn solid sm">Open a court</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ contract }: { contract: string }) {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", marginTop: 72 }}>
      <div className="wrap" style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "28px 20px", fontSize: 13 }}>
        <span className="muted">Unban: ban appeals, decided by the community&apos;s own rules. Ruled by GenLayer validators on Studio Next.</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Link href="/docs" className="muted">Docs</Link>
          <Link href="/docs/more/evaluation" className="muted">Evaluation</Link>
          <Link href="/run" className="muted">Run the evidence</Link>
          {contract ? (
            <a className="muted mono" href={`https://explorer-studio-dev.genlayer.com/address/${contract}`} target="_blank" rel="noreferrer">
              Contract {contract.slice(0, 8)}…
            </a>
          ) : null}
          <a className="muted" href="https://github.com/meitipro/genlayer-unban" target="_blank" rel="noreferrer">GitHub</a>
        </span>
      </div>
    </footer>
  );
}
