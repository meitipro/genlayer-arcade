'use client';
/** /p/[id]/record: the agreed record, printable and shareable. vercel.json rewrites it here. */
import { useEffect, useState } from 'react';
import { readPage, short, verdictLabel, addressUrl, CONTRACT, gen, type Page } from '@/lib/chain';
import { Accounts, TermTable } from '@/components/site/terms';
import { pageIdFromLocation, StepBadge, when } from '@/components/site/bits';

export default function Record() {
  const [page, setPage] = useState<Page | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    const n = pageIdFromLocation();
    setId(n);
    if (n !== null) readPage(n).then(setPage).catch((e) => setError(String(e?.message ?? e).slice(0, 200)));
  }, []);

  if (error) return <div className="wrap" style={{ paddingTop: 36 }}><p className="notice notice-warn">The chain did not answer: {error}</p></div>;
  if (page === undefined) return <div className="wrap" style={{ paddingTop: 36 }}><p className="muted"><span className="spin" /> Reading record #{id ?? ''}…</p></div>;
  if (page === null) return <div className="wrap" style={{ paddingTop: 36 }}><h1 className="serif" style={{ fontSize: 30 }}>No such record</h1></div>;

  const final = [...page.rounds].reverse().find((r) => r.verdict) ?? page.rounds[page.rounds.length - 1];
  return (
    <div className="wrap" style={{ paddingTop: 36, maxWidth: 920 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="eyebrow">Record #{page.id}</span>
        <StepBadge step={page.step} />
        {final?.verdict ? <span className={`verdict verdict-${final.verdict}`} style={{ height: 24, fontSize: 11.5 }}>{verdictLabel(final)}</span> : null}
      </div>
      <h1 className="serif" style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginTop: 8 }}>{page.title}</h1>
      <div className="panel" style={{ padding: 16, marginTop: 16, display: 'grid', gap: 6, fontSize: 14.5 }}>
        <div>Opener <a className="link mono" href={addressUrl(page.opener)}>{page.opener}</a>{final?.a_signed ? ' · signed' : ''}</div>
        <div>Counterparty <a className="link mono" href={addressUrl(page.counterparty)}>{page.counterparty}</a>{final?.b_signed ? ' · signed' : ''}</div>
        <div className="muted">Deposit {gen(page.deposit)} GEN each · round {final?.n ?? page.round} of 2 · checked {when(final?.checked_at ?? 0)}{page.closed_at ? ` · closed ${when(page.closed_at)}` : ''}</div>
        {page.absent.length ? <div className="muted">No-show recorded against {page.absent.map(short).join(' and ')}</div> : null}
        <div className="faint">Contract <a className="link mono" href={addressUrl(CONTRACT)}>{short(CONTRACT)}</a> on GenLayer Studio Next, chain 61997</div>
      </div>
      {final?.verdict ? (
        <section style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600 }}>The six statuses</h2>
          <TermTable round={final} differencesFirst={false} />
          <h2 style={{ fontSize: 19, fontWeight: 600, marginTop: 8 }}>Both accounts, in full</h2>
          <Accounts page={page} round={final} />
          <p className="faint" style={{ fontSize: 13 }}>The record is both full accounts and the six statuses. The note lines are the leader&apos;s reading aid and were never compared or signed.</p>
        </section>
      ) : (
        <p className="muted" style={{ marginTop: 20 }}>No round of this page was checked.</p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }} className="print:hidden">
        <button className="btn" onClick={() => window.print()}>Print</button>
        <button className="btn" onClick={() => navigator.clipboard?.writeText(window.location.href)}>Copy link</button>
        <a className="btn" href={`/p/${page.id}`}>Back to the page</a>
      </div>
    </div>
  );
}
