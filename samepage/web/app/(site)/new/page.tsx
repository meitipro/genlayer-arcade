'use client';
import { useEffect, useState } from 'react';
import { GEN, listPages, returnedOf, same, length } from '@/lib/chain';
import { TEMPLATES } from '@/lib/templates';
import { useWallet } from '@/components/site/wallet';
import { TxStatus, useTx } from '@/components/site/tx';
import { TERM_LABEL } from '@/components/site/terms';

export default function NewPage() {
  const w = useWallet();
  const tx = useTx();
  const [title, setTitle] = useState('');
  const [other, setOther] = useState('');
  const [deposit, setDeposit] = useState('20');
  const [hours, setHours] = useState(48);
  const [tpl, setTpl] = useState('');

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('template');
    if (slug) pick(slug);
  }, []);

  function pick(slug: string) {
    setTpl(slug);
    const t = TEMPLATES.find((x) => x.slug === slug);
    if (t) setTitle((current) => current || t.title);
  }

  const template = TEMPLATES.find((x) => x.slug === tpl);
  const addressOk = /^0x[0-9a-fA-F]{40}$/.test(other.trim());
  const depositWei = (() => {
    if (!/^\d+(\.\d{0,18})?$/.test(deposit.trim())) return null;
    const [whole, frac = ''] = deposit.trim().split('.');
    return BigInt(whole) * GEN + BigInt((frac + '0'.repeat(18)).slice(0, 18));
  })();
  const problems = [
    !title.trim() || length(title.trim()) > 80 ? 'A title is 1 to 80 characters.' : '',
    !addressOk ? 'The counterparty is a full 0x address.' : '',
    addressOk && same(other.trim(), w.address) ? 'The counterparty cannot be you.' : '',
    depositWei === null ? 'The deposit is a number of GEN, possibly 0.' : '',
    hours < 6 || hours > 96 ? 'A window is 6 to 96 hours.' : '',
  ].filter(Boolean);

  const open = () =>
    tx.run(
      { functionName: 'open_page', args: [title.trim(), other.trim(), depositWei ?? 0n, hours], value: depositWei ?? 0n },
      {
        onDone: async (receipt) => {
          let id = returnedOf(receipt);
          if (typeof id !== 'number') {
            const mine = await listPages(w.address, 0, 1).catch(() => null);
            id = mine?.pages?.[0]?.id;
          }
          if (typeof id === 'number') window.location.href = `/p/${id}`;
        },
      },
    );

  return (
    <div className="wrap" style={{ paddingTop: 36, maxWidth: 980 }}>
      <span className="eyebrow">Open a page</span>
      <h1 className="serif" style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginTop: 6 }}>Name the deal and who it is with</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>You pay the deposit now; the counterparty pays the same to join. Nobody writes the deal here: each side writes their own account on the page, sealed until both are in.</p>

      <div style={{ display: 'grid', gap: 24, marginTop: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div>
            <label className="label" htmlFor="tpl">Start from a template (optional)</label>
            <select id="tpl" className="select" value={tpl} onChange={(e) => pick(e.target.value)}>
              <option value="">No template</option>
              {TEMPLATES.map((t) => <option key={t.slug} value={t.slug}>{t.name}, {t.who.toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Kiln launch posts" />
            <div className="faint mono" style={{ fontSize: 12, marginTop: 4, textAlign: 'right' }}>{length(title)} / 80</div>
          </div>
          <div>
            <label className="label" htmlFor="other">Counterparty address</label>
            <input id="other" className="input mono" value={other} onChange={(e) => setOther(e.target.value)} placeholder="0x…" spellCheck={false} />
            <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>Only this address can join.</div>
          </div>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="label" htmlFor="dep">Deposit, each side (GEN)</label>
              <input id="dep" className="input" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="hrs">Window per step (hours)</label>
              <input id="hrs" className="input" type="number" min={6} max={96} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
            </div>
          </div>
          {problems.length && (title || other) ? <ul className="faint" style={{ fontSize: 13.5, paddingLeft: 18, listStyle: 'disc' }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}
          <div>
            <button className="btn btn-solid" disabled={problems.length > 0 || tx.state.kind === 'busy'} onClick={open}>
              Open the page{depositWei ? ` with ${deposit} GEN` : ''}
            </button>
          </div>
          <TxStatus state={tx.state} fee={tx.fee} onRetry={() => tx.reset()} />
        </div>
        <div className="panel" style={{ padding: 18, alignSelf: 'start' }}>
          <div className="eyebrow">{template ? `${template.name}: what each side should say` : 'What each account should say'}</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 12, fontSize: 14.5 }}>
            {(Object.keys(TERM_LABEL) as (keyof typeof TERM_LABEL)[]).map((t) => (
              <div key={t}>
                <div style={{ fontWeight: 500 }}>{TERM_LABEL[t]}{['amount', 'deliverable', 'deadline'].includes(t) ? <span className="faint mono" style={{ fontSize: 11, marginLeft: 8 }}>required</span> : null}</div>
                <div className="muted">{template ? template.hints[t as never] : DEFAULT_HINTS[t]}</div>
              </div>
            ))}
          </div>
          <p className="faint" style={{ fontSize: 13, marginTop: 12 }}>Hints, never a prefilled account. Each side writes in their own words.</p>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_HINTS: Record<string, string> = {
  amount: 'The price, the currency and any quantity.',
  deliverable: 'What exactly is delivered or done.',
  deadline: 'When it is due, as a date.',
  payment: 'When and how payment is made.',
  rights: 'Who owns or may use the result.',
  cancellation: 'What happens if either side backs out.',
};
