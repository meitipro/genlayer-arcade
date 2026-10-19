'use client';
/**
 * /p/[id]: one page, read with no wallet, written with one. vercel.json
 * rewrites /p/<id> here; the id is read from the path (or ?id= in dev).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TERMS, gen, length, newSalt, readPage, same, sealOf, short, verdictLabel, addressUrl, txUrl, CONTRACT,
  type Page, type Round,
} from '@/lib/chain';
import { mentions } from '@/lib/hints';
import { downloadTicket, loadTicket, parseTicket, saveTicket, type Ticket } from '@/lib/tickets';
import { useWallet } from '@/components/site/wallet';
import { TxStatus, useTx } from '@/components/site/tx';
import { Accounts, TermTable, TERM_LABEL } from '@/components/site/terms';
import { Countdown, pageIdFromLocation, StepBadge } from '@/components/site/bits';

const MAX = 1200;

export default function PageView() {
  const [id, setId] = useState<number | null>(null);
  const [page, setPage] = useState<Page | null | undefined>(undefined);
  const [error, setError] = useState('');
  const w = useWallet();

  useEffect(() => setId(pageIdFromLocation()), []);

  const load = useCallback(async () => {
    if (id === null) return;
    try {
      setPage(await readPage(id));
      setError('');
    } catch (e) {
      setError(String((e as Error)?.message ?? e).slice(0, 200));
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  if (id === null) return <Shell><p className="muted">Reading the page number…</p></Shell>;
  if (!CONTRACT) return <Shell><p className="notice notice-warn">This build has no contract address.</p></Shell>;
  if (page === undefined)
    return (
      <Shell>
        {error ? <p className="notice notice-warn">The chain did not answer: {error}. <button className="btn btn-sm" onClick={load}>Retry</button></p> : <p className="muted"><span className="spin" /> Reading page #{id} from Studio Next…</p>}
      </Shell>
    );
  if (page === null)
    return (
      <Shell>
        <h1 className="serif" style={{ fontSize: 32 }}>There is no page #{id}</h1>
        <p className="muted" style={{ marginTop: 8 }}>Nobody has opened it yet. <a className="link" href="/new">Open a page</a>.</p>
      </Shell>
    );

  const me = w.address;
  const side: 'a' | 'b' | null = same(me, page.opener) ? 'a' : same(me, page.counterparty) ? 'b' : null;
  const round = page.rounds[page.round - 1];
  const previous = page.round > 1 ? page.rounds[0] : null;
  const now = Math.floor(Date.now() / 1000);
  const expired = now > page.deadline && ['JOINING', 'SEALING', 'OPENING', 'CHECKING', 'SIGNING'].includes(page.step);
  const checked = page.rounds.filter((r) => r.verdict);
  const latestChecked = checked[checked.length - 1];
  const otherName = (who: 'a' | 'b') => (who === 'a' ? `the opener ${short(page.opener)}` : `the counterparty ${short(page.counterparty)}`);

  return (
    <Shell>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="eyebrow">Page #{page.id} · round {page.round} of 2</span>
        <StepBadge step={page.step} />
      </div>
      <h1 className="serif" style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginTop: 8, lineHeight: 1.15 }}>{page.title}</h1>
      <p className="muted" style={{ marginTop: 6, fontSize: 15 }}>
        <a className="link mono" href={addressUrl(page.opener)} target="_blank" rel="noreferrer">{short(page.opener)}</a> opened,{' '}
        <a className="link mono" href={addressUrl(page.counterparty)} target="_blank" rel="noreferrer">{short(page.counterparty)}</a>{' '}
        {page.step === 'JOINING' ? 'is named' : 'joined'} · {gen(page.deposit)} GEN deposit each · {page.window_hours} h per step
        {side ? <> · you are the {side === 'a' ? 'opener' : 'counterparty'}</> : null}
      </p>

      <div className="page-grid">
        <div style={{ display: 'grid', gap: 22, alignContent: 'start' }}>
          <StepPanel page={page} round={round} previous={previous} side={side} expired={expired} reload={load} otherName={otherName} />

          {checked.slice().reverse().map((r) => (
            <section key={r.n} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 19, fontWeight: 600 }}>Round {r.n} result</h2>
                <span className={`verdict verdict-${r.verdict}`}>{verdictLabel(r)}</span>
              </div>
              <TermTable round={r} />
              <p className="faint" style={{ fontSize: 13 }}>Lines are the leader&apos;s notes, a reading aid. The record is both full accounts and the six statuses.</p>
              <Accounts page={page} round={r} me={me} />
            </section>
          ))}
        </div>

        <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          {latestChecked ? (
            <div className="panel" style={{ padding: 18 }}>
              <div className="eyebrow">Result</div>
              <div style={{ marginTop: 10 }}><span className={`verdict verdict-${latestChecked.verdict}`}>{verdictLabel(latestChecked)}</span></div>
              <p className="muted" style={{ marginTop: 10, fontSize: 14.5 }}>{resultSentence(latestChecked, page)}</p>
            </div>
          ) : null}
          {['JOINING', 'SEALING', 'OPENING', 'CHECKING', 'SIGNING'].includes(page.step) ? (
            <div className="panel" style={{ padding: 18 }}>
              <div className="eyebrow">Window</div>
              <p style={{ marginTop: 8, fontSize: 15 }}><Countdown until={page.deadline} /></p>
            </div>
          ) : null}
          <div className="panel" style={{ padding: 18, display: 'grid', gap: 8, fontSize: 14.5 }}>
            <div className="eyebrow">Deposits</div>
            <Row k="Each side" v={`${gen(page.deposit)} GEN`} />
            <Row k="Back when" v="both sign" />
            <Row k="If round 2 differs" v="back to both" />
            <Row k="If a side vanishes" v="to the other" />
          </div>
          {page.step === 'AGREED' || page.step === 'NOT_AGREED' || page.step === 'NO_SHOW' ? (
            <a className="btn" href={`/p/${page.id}/record`}>Open the record</a>
          ) : null}
          <div className="panel" style={{ padding: 18, fontSize: 13.5 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Seals this round</div>
            <SealLine who={`Opener ${short(page.opener)}`} seal={round?.a_seal} />
            <SealLine who={`Counterparty ${short(page.counterparty)}`} seal={round?.b_seal} />
            <p className="faint" style={{ marginTop: 8 }}>Nothing else, until you both open.</p>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function resultSentence(r: Round, page: Page): string {
  const differ = TERMS.filter((_, i) => r.statuses[i] === 'DIFFER').map((t) => TERM_LABEL[t].toLowerCase());
  const gaps = ['amount', 'deliverable', 'deadline'].filter((t) => r.statuses[TERMS.indexOf(t as never)] === 'ABSENT');
  if (r.verdict === 'SAME_PAGE') return page.step === 'AGREED' ? 'Both signed. The deposits are back in both balances.' : 'Both accounts describe the same deal. Each side signs to make it the record.';
  if (r.verdict === 'DIFFERENT')
    return r.n === 1
      ? `The accounts differ on ${differ.join(' and ')}. Talk it through, then each writes round 2. Either side may keep their text.`
      : `Round 2 still differs on ${differ.join(' and ')}. The page closed NOT AGREED and both deposits came back.`;
  return r.n === 1
    ? `No differences, but neither states the ${gaps.join(' or ')}. Add it in round 2.`
    : `Round 2 still leaves out the ${gaps.join(' and ')}. The page closed NOT AGREED and both deposits came back.`;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function SealLine({ who, seal }: { who: string; seal?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
      <span className="muted">{who}</span>
      <span className="mono">{seal ? `${seal.slice(0, 4)}…${seal.slice(-4)}` : 'not sealed'}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="wrap" style={{ paddingTop: 36 }}>{children}</div>;
}

function StepPanel({
  page, round, previous, side, expired, reload, otherName,
}: {
  page: Page; round: Round; previous: Round | null; side: 'a' | 'b' | null; expired: boolean; reload: () => void;
  otherName: (who: 'a' | 'b') => string;
}) {
  const tx = useTx();
  const w = useWallet();
  const done = () => setTimeout(reload, 1500);

  if (expired) {
    return (
      <section className="panel noshow" style={{ padding: 20, display: 'grid', gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>The window for this step has closed</h2>
        <p className="muted">
          {page.step === 'JOINING'
            ? 'The counterparty never joined. Settling returns the opener’s deposit.'
            : page.step === 'CHECKING'
              ? 'Nobody ran the check in time. Settling closes the page as NOT AGREED and returns both deposits.'
              : 'Settling moves the absent side’s deposit to the side that showed up. If both missed it, each gets their own back.'}{' '}
          Anyone can settle it; the rule decides, not the caller.
        </p>
        <div><button className="btn btn-solid" onClick={() => tx.run({ functionName: 'no_show', args: [page.id] }, { onDone: done })}>Settle the no-show</button></div>
        <TxStatus state={tx.state} fee={tx.fee} onRetry={() => tx.reset()} />
      </section>
    );
  }

  switch (page.step) {
    case 'JOINING':
      return (
        <section className="panel" style={{ padding: 20, display: 'grid', gap: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{side === 'b' ? 'You are invited to this page' : 'Waiting for the counterparty to join'}</h2>
          {side === 'b' ? (
            <>
              <p className="muted">Join with the same {gen(page.deposit)} GEN deposit. It comes back when you both sign, and goes to the other side only if you walk away.</p>
              <div><button className="btn btn-solid" onClick={() => tx.run({ functionName: 'join', args: [page.id], value: BigInt(page.deposit) }, { onDone: done })}>Join with {gen(page.deposit)} GEN</button></div>
            </>
          ) : side === 'a' ? (
            <p className="muted">Send this page&apos;s link to {otherName('b')}. Only that address can join. <CopyLink /></p>
          ) : (
            <p className="muted">Only {otherName('b')} can join. {!w.address ? 'If that is you, connect your wallet.' : ''}</p>
          )}
          <TxStatus state={tx.state} fee={tx.fee} onRetry={() => tx.reset()} />
        </section>
      );
    case 'SEALING':
      return <WriteAndSeal page={page} round={round} previous={previous} side={side} reload={reload} otherName={otherName} />;
    case 'OPENING':
      return <OpenAccount page={page} round={round} side={side} reload={reload} otherName={otherName} />;
    case 'CHECKING':
      return (
        <section className="panel" style={{ padding: 20, display: 'grid', gap: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Both accounts are open. Run the check.</h2>
          <p className="muted">GenLayer validators compare the two accounts on six terms, each in both orders, and must agree on every status. The result follows from those six statuses in the contract. Anyone may run it; it usually takes one to three minutes.</p>
          <div><button className="btn btn-solid" onClick={() => tx.run({ functionName: 'check', args: [page.id] }, { waiting: 'Validators are comparing the two accounts', onDone: done })} disabled={tx.state.kind === 'busy'}>Run the check</button></div>
          <TxStatus state={tx.state} fee={tx.fee} onRetry={() => tx.reset()} />
          <Accounts page={page} round={round} me={w.address} />
        </section>
      );
    case 'SIGNING': {
      const mine = side === 'a' ? round.a_signed : side === 'b' ? round.b_signed : false;
      return (
        <section className="panel" style={{ padding: 20, display: 'grid', gap: 12, borderColor: 'var(--teal)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Same page. Read both accounts, then sign.</h2>
          <p className="muted">Signing makes both texts and the six statuses the record. When both have signed, both deposits go back into your balances, to withdraw from <a className="link" href="/me">My pages</a>.</p>
          <p style={{ fontSize: 14.5 }}>Opener {round.a_signed ? 'signed' : 'has not signed'} · counterparty {round.b_signed ? 'signed' : 'has not signed'}</p>
          {side && !mine ? <div><button className="btn btn-solid" onClick={() => tx.run({ functionName: 'sign', args: [page.id] }, { onDone: done })}>Sign the record</button></div> : null}
          <TxStatus state={tx.state} fee={tx.fee} onRetry={() => tx.reset()} />
        </section>
      );
    }
    case 'AGREED':
      return <Closed page={page} title="Agreed. Both signed." text="Both accounts and the six statuses are the record. Both deposits are back in the two balances." />;
    case 'NOT_AGREED':
      return <Closed page={page} title="Not agreed" text="Two rounds and still not the same deal, or a check that never landed. Disagreeing honestly is not ghosting: both deposits came back." />;
    case 'NO_SHOW':
      return <Closed page={page} title="No-show" text={`Recorded against ${page.absent.map(short).join(' and ')}. ${page.absent.length === 2 ? 'Both missed the same step, so each got their own deposit back.' : 'The absent side’s deposit went to the other.'}`} dotted />;
  }
}

function Closed({ page, title, text, dotted }: { page: Page; title: string; text: string; dotted?: boolean }) {
  return (
    <section className={`panel ${dotted ? 'noshow' : ''}`} style={{ padding: 20, display: 'grid', gap: 10 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>{title}</h2>
      <p className="muted">{text}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a className="btn" href={`/p/${page.id}/record`}>Open the record</a>
        <a className="btn" href="/me">Withdraw from My pages</a>
      </div>
    </section>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button className="btn btn-sm" style={{ marginLeft: 6 }} onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true))}>
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

function WriteAndSeal({ page, round, previous, side, reload, otherName }: { page: Page; round: Round; previous: Round | null; side: 'a' | 'b' | null; reload: () => void; otherName: (w: 'a' | 'b') => string }) {
  const w = useWallet();
  const tx = useTx();
  const mineSealed = side === 'a' ? !!round.a_seal : side === 'b' ? !!round.b_seal : false;
  const theirsSealed = side === 'a' ? !!round.b_seal : side === 'b' ? !!round.a_seal : false;
  const myPrevious = previous ? (side === 'a' ? previous.a_text : previous.b_text) : '';
  const [text, setText] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const hints = useMemo(() => mentions(text), [text]);
  const differed = previous ? TERMS.filter((_, i) => previous.statuses[i] === 'DIFFER' || (['amount', 'deliverable', 'deadline'].includes(TERMS[i]) && previous.statuses[i] === 'ABSENT')) : [];

  useEffect(() => {
    if (w.address) setTicket(loadTicket(page.id, page.round, w.address));
  }, [w.address, page.id, page.round]);

  if (!side) {
    return (
      <section className="panel" style={{ padding: 20, display: 'grid', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Both sides are writing</h2>
        <p className="muted">Opener {round.a_seal ? 'sealed' : 'has not sealed'} · counterparty {round.b_seal ? 'sealed' : 'has not sealed'}. Accounts stay sealed until both are in.</p>
        {!w.address ? <p className="faint">If you are a side of this page, connect your wallet.</p> : null}
      </section>
    );
  }
  if (mineSealed) {
    return (
      <section className="panel" style={{ padding: 20, display: 'grid', gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Your account is sealed</h2>
        <p className="muted">{theirsSealed ? 'Both are sealed.' : `Waiting for ${otherName(side === 'a' ? 'b' : 'a')} to seal.`} Your ticket is {ticket ? 'saved in this browser' : <b style={{ color: 'var(--differ)' }}>not in this browser</b>}; it is what opens your account next.</p>
        {ticket ? <div><button className="btn btn-sm" onClick={() => downloadTicket(ticket)}>Download the ticket</button></div> : null}
      </section>
    );
  }

  const n = length(text);
  const seal = async () => {
    const address = w.address || (await w.connect());
    const salt = newSalt();
    const value = await sealOf(text, salt, address);
    const t: Ticket = { text, salt, seal: value, page: page.id, round: page.round, address, contract: CONTRACT };
    saveTicket(t); // before the transaction: a sealed account without its ticket cannot be opened
    setTicket(t);
    await tx.run({ functionName: 'seal', args: [page.id, value] }, { onDone: () => setTimeout(reload, 1500) });
  };

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>Write your account</h2>
        <p className="muted" style={{ marginTop: 4 }}>{page.title} · round {page.round} of 2 · {otherName(side === 'a' ? 'b' : 'a')} {theirsSealed ? 'has sealed theirs' : 'has not sealed yet'}</p>
      </div>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <div style={{ display: 'grid', gap: 8, gridColumn: 'span 2 / span 2' }} className="min-w-0">
          <label className="label" htmlFor="account">The deal, in your own words</label>
          <textarea id="account" className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Say what is delivered, for how much, by when, how it is paid, who may use it, and what happens if either side backs out." />
          <div style={{ display: 'flex', justifyContent: 'space-between' }} className="faint">
            <span style={{ fontSize: 13 }}>Any language, any order</span>
            <span className="mono" style={{ fontSize: 12.5, color: n > MAX ? 'var(--danger)' : undefined }}>{n.toLocaleString('en')} / 1,200</span>
          </div>
          {differed.length ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="eyebrow">Round 1 {previous?.verdict === 'GAPS' ? 'left out' : 'differed on'}</span>
              {differed.map((t) => <span key={t} className="pill" style={{ borderColor: 'var(--differ)', color: 'var(--differ)' }}>{TERM_LABEL[t]}</span>)}
              <span className="faint" style={{ fontSize: 13.5 }}>Settle these with the other side before you seal.</span>
            </div>
          ) : null}
          {myPrevious ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => setText(myPrevious)}>Start from my round 1 text</button>
              <span className="faint" style={{ fontSize: 13 }}>Either side may keep their text.</span>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <button className="btn btn-solid" disabled={n === 0 || n > MAX || !text.trim() || tx.state.kind === 'busy'} onClick={() => seal().catch(() => {})}>Seal my account</button>
            <span className="faint" style={{ fontSize: 13.5 }}>Your ticket is saved in this browser</span>
          </div>
          <TxStatus state={tx.state} fee={tx.fee} onRetry={() => tx.reset()} />
        </div>
        <div className="panel" style={{ padding: 16, alignSelf: 'start' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Terms your text mentions</div>
          {TERMS.map((t) => (
            <div key={t} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 14 }}>
              <span>{TERM_LABEL[t]}</span>
              <span className={hints[t] ? '' : 'faint'} style={{ textAlign: 'right' }}>{hints[t] ?? 'not mentioned'}</span>
            </div>
          ))}
          <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>A hint from your text only, worked out in this browser. The validators read both.</p>
        </div>
      </div>
      {myPrevious ? (
        <div className="panel" style={{ padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Your round 1 account</div>
          <div className="account-text muted">{myPrevious}</div>
        </div>
      ) : null}
    </section>
  );
}

function OpenAccount({ page, round, side, reload, otherName }: { page: Page; round: Round; side: 'a' | 'b' | null; reload: () => void; otherName: (w: 'a' | 'b') => string }) {
  const w = useWallet();
  const tx = useTx();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [paste, setPaste] = useState('');
  const [bad, setBad] = useState('');
  const opened = side === 'a' ? !!round.a_text : side === 'b' ? !!round.b_text : false;
  const mySeal = side === 'a' ? round.a_seal : round.b_seal;

  useEffect(() => {
    if (w.address) setTicket(loadTicket(page.id, page.round, w.address));
  }, [w.address, page.id, page.round]);

  if (!side) {
    return (
      <section className="panel" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Both sealed. Each side now opens.</h2>
        <p className="muted" style={{ marginTop: 6 }}>Opener {round.a_text ? 'opened' : 'has not opened'} · counterparty {round.b_text ? 'opened' : 'has not opened'}.</p>
      </section>
    );
  }
  if (opened) {
    return (
      <section className="panel" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Your account is open</h2>
        <p className="muted" style={{ marginTop: 6 }}>Waiting for {otherName(side === 'a' ? 'b' : 'a')} to open theirs. Then anyone can run the check.</p>
      </section>
    );
  }
  const importTicket = async (raw: string) => {
    const t = parseTicket(raw);
    if (!t) return setBad('That is not a Samepage ticket.');
    const check = await sealOf(t.text, t.salt, w.address);
    if (check !== mySeal) return setBad('That ticket does not match your seal on this page and round.');
    saveTicket({ ...t, page: page.id, round: page.round, address: w.address, contract: CONTRACT });
    setTicket(t);
    setBad('');
  };
  return (
    <section className="panel" style={{ padding: 20, display: 'grid', gap: 12 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>Both sealed. Open your account.</h2>
      {ticket ? (
        <>
          <div className="panel" style={{ padding: 14, background: 'var(--ground)' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>What you sealed</div>
            <div className="account-text">{ticket.text}</div>
          </div>
          <div><button className="btn btn-solid" onClick={() => tx.run({ functionName: 'reveal', args: [page.id, ticket.text, ticket.salt] }, { onDone: () => setTimeout(reload, 1500) })}>Open my account</button></div>
        </>
      ) : (
        <div className="notice notice-warn" style={{ display: 'grid', gap: 10 }}>
          <b>Your ticket is not in this browser.</b>
          <span>An account opens only with the exact text and salt that were sealed. Use the browser you sealed in, or load the ticket file you downloaded. If it cannot be opened before the window closes, it counts as a no-show.</span>
          <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0]?.text().then(importTicket)} />
          <textarea className="textarea" style={{ minHeight: 80 }} placeholder="…or paste the ticket JSON here" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <div><button className="btn btn-sm" onClick={() => importTicket(paste)}>Use this ticket</button></div>
          {bad ? <span style={{ color: 'var(--danger)' }}>{bad}</span> : null}
        </div>
      )}
      <TxStatus state={tx.state} fee={tx.fee} onRetry={() => tx.reset()} />
      {tx.state.kind === 'done' ? <a className="link" href={txUrl(tx.state.hash)}>opened</a> : null}
    </section>
  );
}
