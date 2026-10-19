'use client';
import { useCallback, useEffect, useState } from 'react';
import { gen, listPages, ZERO, short, verdictLabel, type Listing, type Page } from '@/lib/chain';
import { useWallet } from '@/components/site/wallet';
import { TxStatus, useTx } from '@/components/site/tx';
import { Countdown, StepBadge } from '@/components/site/bits';

const ORDER = ['SEALING', 'OPENING', 'SIGNING', 'JOINING', 'CHECKING', 'AGREED', 'NOT_AGREED', 'NO_SHOW'];

export default function Me() {
  const w = useWallet();
  const tx = useTx();
  const [mine, setMine] = useState<Listing | null>(null);
  const [all, setAll] = useState<Listing | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setAll(await listPages(ZERO, 0, 30));
      if (w.address) setMine(await listPages(w.address, 0, 50));
      setError('');
    } catch (e) {
      setError(String((e as Error)?.message ?? e).slice(0, 200));
    }
  }, [w.address]);
  useEffect(() => { load(); }, [load]);

  const now = Math.floor(Date.now() / 1000);
  const live = (p: Page) => ['JOINING', 'SEALING', 'OPENING', 'CHECKING', 'SIGNING'].includes(p.step);
  const soon = (mine?.pages ?? []).filter((p) => live(p) && p.deadline - now < 12 * 3600);
  const sorted = [...(mine?.pages ?? [])].sort((a, b) => ORDER.indexOf(a.step) - ORDER.indexOf(b.step) || b.id - a.id);
  const balance = BigInt(mine?.balance ?? '0');

  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <span className="eyebrow">Pages</span>
      <h1 className="serif" style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginTop: 6 }}>{w.address ? 'My pages' : 'Pages'}</h1>
      {error ? <p className="notice notice-warn" style={{ marginTop: 12 }}>The chain did not answer: {error} <button className="btn btn-sm" onClick={load}>Retry</button></p> : null}

      {w.address ? (
        <div style={{ display: 'grid', gap: 16, marginTop: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div className="panel" style={{ padding: 18, display: 'grid', gap: 8 }}>
            <div className="eyebrow">Balance in Samepage</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{gen(balance, 4)} GEN</div>
            <div className="faint" style={{ fontSize: 13.5 }}>Deposits come back here; withdraw is its own transaction. {mine?.no_shows ? `${mine.no_shows} no-show${mine.no_shows > 1 ? 's' : ''} recorded against this address.` : ''}</div>
            <div><button className="btn btn-solid btn-sm" disabled={balance === 0n || tx.state.kind === 'busy'} onClick={() => tx.run({ functionName: 'withdraw', args: [] }, { onDone: () => setTimeout(load, 1500) })}>Withdraw {gen(balance, 4)} GEN</button></div>
            <TxStatus state={tx.state} fee={tx.fee} onRetry={() => tx.reset()} />
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <div className="eyebrow">Windows closing soon</div>
            {soon.length ? soon.map((p) => (
              <a key={p.id} href={`/p/${p.id}`} style={{ display: 'block', padding: '6px 0', fontSize: 14.5 }}>#{p.id} {p.title} · <Countdown until={p.deadline} /></a>
            )) : <p className="faint" style={{ marginTop: 8, fontSize: 14 }}>Nothing closes in the next 12 hours.</p>}
          </div>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>Connect your wallet to see your pages, your balance and withdraw. Every page below is public and needs no wallet to read.</p>
      )}

      {w.address ? (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 10 }}>By step</h2>
          {mine && sorted.length === 0 ? <p className="faint">No pages yet. <a className="link" href="/new">Open one</a>.</p> : null}
          <PageList pages={sorted} me={w.address} />
        </section>
      ) : null}

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 10 }}>Every page, newest first {all ? <span className="faint" style={{ fontSize: 14, fontWeight: 400 }}>({all.total})</span> : null}</h2>
        {all && all.pages.length === 0 ? <p className="faint">No pages on this contract yet.</p> : null}
        {!all && !error ? <p className="muted"><span className="spin" /> Reading from Studio Next…</p> : null}
        <PageList pages={all?.pages ?? []} />
      </section>
    </div>
  );
}

function PageList({ pages, me }: { pages: Page[]; me?: string }) {
  return (
    <div className="panel" style={{ overflowX: 'auto' }}>
      <table className="terms">
        <tbody>
          {pages.map((p) => {
            const last = [...p.rounds].reverse().find((r) => r.verdict);
            return (
              <tr key={p.id}>
                <td className="mono faint" style={{ width: 60 }}>#{p.id}</td>
                <td><a href={`/p/${p.id}`} style={{ fontWeight: 500 }}>{p.title}</a><div className="faint" style={{ fontSize: 13 }}>{short(p.opener)} and {short(p.counterparty)}{me ? (p.opener.toLowerCase() === me.toLowerCase() ? ' · you opened' : ' · you were named') : ''} · {gen(p.deposit)} GEN each</div></td>
                <td style={{ textAlign: 'right' }}>{last ? <span className={`st st-${last.verdict === 'SAME_PAGE' ? 'MATCH' : last.verdict === 'DIFFERENT' ? 'DIFFER' : 'ABSENT'}`} style={{ marginRight: 10 }}>{verdictLabel(last)}</span> : null}<StepBadge step={p.step} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
