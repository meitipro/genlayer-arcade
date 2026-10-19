'use client';
import Link from 'next/link';
import { useWallet } from './wallet';
import { short } from '@/lib/chain';
import { Logo } from './logo';

export function Nav() {
  const w = useWallet();
  return (
    <header style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 22, height: 64 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 18 }} aria-label="Samepage home">
          <Logo size={22} />
          samepage
        </Link>
        <nav style={{ display: 'flex', gap: 18, fontSize: 15 }} className="muted hidden md:flex">
          <Link href="/me">Pages</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/docs">Docs</Link>
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="pill hidden sm:inline-flex" title="Chain 61997">
            <span className="dot" /> Studio Next
          </span>
          {w.address ? (
            w.chainOk ? (
              <Link href="/me" className="btn btn-sm mono">{short(w.address)}</Link>
            ) : (
              <button className="btn btn-sm" onClick={() => w.switchNetwork().catch(() => {})}>Switch to 61997</button>
            )
          ) : (
            <button className="btn btn-sm" onClick={() => w.connect().catch(() => {})} disabled={w.connecting}>
              {w.connecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
          <Link href="/new" className="btn btn-sm btn-solid hidden sm:inline-flex">Open a page</Link>
        </div>
      </div>
      {w.error ? (
        <div className="wrap" style={{ paddingBottom: 10 }}>
          <div className="notice notice-warn">{w.error}</div>
        </div>
      ) : null}
    </header>
  );
}
