'use client';
/**
 * The landing page's two live pieces. Each first shows what the seed run
 * recorded (lib/seed.json, written by scripts/seed.py from the chain), then
 * replaces it with a fresh read. Neither ever shows an invented page.
 */
import { useEffect, useState } from 'react';
import { listPages, readPage, ZERO, short, verdictLabel, gen, TERMS, type Page, type Round } from '@/lib/chain';
import seed from '@/lib/seed.json';
import { TERM_LABEL } from './terms';

type Seed = { recorded_at?: string; agreed?: { id: number; page: Page }; round2?: { id: number; page: Page }; noshow?: { id: number; page: Page } };
const S = seed as Seed;

export function useSeedPage(which: 'agreed' | 'round2'): { page: Page | null; live: boolean } {
  const recorded = S[which];
  const [page, setPage] = useState<Page | null>(recorded?.page ?? null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!recorded) return;
    readPage(recorded.id).then((p) => { if (p) { setPage(p); setLive(true); } }).catch(() => {});
  }, [recorded]);
  return { page, live };
}

export function AgreedCard() {
  const { page, live } = useSeedPage('agreed');
  if (!page) return <div className="panel" style={{ padding: 22 }}><p className="muted">No agreed page has been recorded on this contract yet.</p></div>;
  const final = [...page.rounds].reverse().find((r) => r.verdict) as Round | undefined;
  return (
    <a href={`/p/${page.id}/record`} className="panel" style={{ display: 'block', padding: 22, borderColor: 'var(--teal)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span className="eyebrow">Page #{page.id} · {page.title}</span>
        <span className={`verdict verdict-${page.step === 'AGREED' ? 'AGREED' : final?.verdict ?? 'GAPS'}`} style={{ height: 24, fontSize: 11.5 }}>{page.step === 'AGREED' ? 'AGREED' : page.step.replace('_', ' ')}</span>
      </div>
      <p className="faint" style={{ fontSize: 13.5, marginTop: 8 }}>
        {short(page.opener)} and {short(page.counterparty)} wrote it separately{final ? ` · ${verdictLabel(final).toLowerCase()} in round ${final.n}` : ''}
      </p>
      {final ? (
        <table className="terms" style={{ marginTop: 12 }}>
          <tbody>
            {TERMS.map((t, i) => (
              <tr key={t} className={`row-${final.statuses[i]}`}>
                <td style={{ width: 120, padding: '9px 10px' }}>{TERM_LABEL[t]}</td>
                <td className={final.statuses[i] === 'ABSENT' ? 'faint' : ''} style={{ padding: '9px 10px', fontSize: 13.5 }}>{final.notes?.[t] ?? (final.statuses[i] === 'ABSENT' ? 'Neither mentions it' : '')}</td>
                <td style={{ textAlign: 'right', padding: '9px 10px' }}><span className={`st st-${final.statuses[i]}`}>{final.statuses[i]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className="faint" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13 }}>
        <span>{page.step === 'AGREED' ? `Both signed · ${gen(page.deposit)} GEN deposits back` : 'Not yet signed'}</span>
        <span>{live ? 'read live from Studio Next' : `as recorded ${S.recorded_at ?? ''}`}</span>
      </div>
    </a>
  );
}

export function DifferenceExample() {
  const { page } = useSeedPage('agreed');
  const r1 = page?.rounds[0];
  if (!page || !r1?.verdict || r1.verdict === 'SAME_PAGE') return null;
  const i = r1.statuses.findIndex((s) => s === 'DIFFER');
  if (i < 0) return null;
  const term = TERMS[i];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="panel row-DIFFER" style={{ padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>{TERM_LABEL[term]}</span>
          <span className="st st-DIFFER">DIFFER</span>
        </div>
        <p style={{ fontSize: 15 }}>{r1.notes?.[term]}</p>
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div className="panel" style={{ padding: 14 }}><div className="eyebrow">Opener wrote</div><p className="account-text" style={{ marginTop: 6, fontSize: 14 }}>{r1.a_text}</p></div>
        <div className="panel" style={{ padding: 14 }}><div className="eyebrow">Counterparty wrote</div><p className="account-text" style={{ marginTop: 6, fontSize: 14 }}>{r1.b_text}</p></div>
      </div>
      <p className="faint" style={{ fontSize: 13 }}>Round 1 of page #{page.id}, as the result page shows it. <a className="link" href={`/p/${page.id}`}>See the whole page</a>.</p>
    </div>
  );
}

export function RecentChecks() {
  const [rows, setRows] = useState<{ id: number; title: string; label: string; verdict: string }[] | null>(null);
  useEffect(() => {
    listPages(ZERO, 0, 20)
      .then((l) => {
        const out: { id: number; title: string; label: string; verdict: string }[] = [];
        for (const p of l.pages) for (const r of p.rounds) if (r.verdict) out.push({ id: p.id, title: `${p.title} round ${r.n}`, label: verdictLabel(r), verdict: r.verdict });
        setRows(out.slice(0, 8));
      })
      .catch(() => setRows([]));
  }, []);
  if (!rows) return <span className="faint"><span className="spin" /> reading recent checks</span>;
  if (!rows.length) return <span className="faint">No checks on this contract yet.</span>;
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
      {rows.map((r, i) => (
        <a key={i} href={`/p/${r.id}`} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <span className={`st st-${r.verdict === 'SAME_PAGE' ? 'MATCH' : r.verdict === 'DIFFERENT' ? 'DIFFER' : 'ABSENT'}`}>{r.label}</span>
          <span className="muted">{r.title}</span>
        </a>
      ))}
    </div>
  );
}
