import Link from 'next/link';
import { AgreedCard, DifferenceExample, RecentChecks } from '@/components/site/live';
import { TERM_LABEL, TERM_MEANS } from '@/components/site/terms';

const EXAMPLES: Record<string, string> = {
  amount: '"600 USDC" against "600 USDT" is a difference: the currency is part of the amount.',
  deliverable: '"3 posts and a thread" against "3 posts" is a difference; "3 posts on X" against "three tweets" is not.',
  deadline: '"By Friday" against "by Oct 16" differs unless the texts make clear it is the same day.',
  payment: '"Half upfront, half after" against "paid after delivery" is a difference.',
  rights: 'Only one side writing "Kiln may repost" is a difference: stated by one side only.',
  cancellation: 'Neither side mentioning it is fine. Optional terms only have to agree when mentioned.',
};

const FAQ = [
  ['Is it a contract?', 'It is a record both sides wrote and signed: two accounts of the deal, six statuses and two signatures, public and timestamped. It checks that the accounts agree, not that the deal is fair or legal, and it holds no payment for the work.'],
  ['Who sees my account?', 'Nobody, until both sides have sealed: the chain holds only a hash. Once both open, both accounts are public on chain, so Samepage suits deals that can be public.'],
  ['What if they ghost?', 'Every step has a window you choose, 6 to 96 hours. A side that misses one loses its deposit to the other, and anyone can settle it after the window closes. Disagreeing honestly twice is not ghosting: both deposits come back.'],
  ['Who decides whether we agree?', 'Several GenLayer validators read both accounts and label each of six terms MATCH, DIFFER or ABSENT, in both orders. They must agree on every label. The result is computed from those labels in the contract, never from the model’s words.'],
  ['Which network?', 'GenLayer Studio Next, chain 61997. The site connects your wallet to it, and the Studio faucet covers fees and deposits.'],
];

export default function Home() {
  return (
    <>
      <section className="wrap" style={{ paddingTop: 56, paddingBottom: 40, display: 'grid', gap: 40, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'center' }}>
        <div>
          <span className="eyebrow">Deal checks, judged on GenLayer</span>
          <h1 className="serif" style={{ fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.04, marginTop: 14, letterSpacing: '-0.01em' }}>
            Agree on the deal before the work starts.
          </h1>
          <p className="muted" style={{ fontSize: 18, lineHeight: 1.55, marginTop: 18, maxWidth: 520 }}>
            Both sides write the deal in their own words, sealed so neither copies. GenLayer validators compare six terms and show exactly where you differ. Sign only when you are on the same page.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
            <Link href="/new" className="btn btn-solid">Open a page</Link>
            <a href="#example" className="btn">See an example</a>
          </div>
          <p className="faint" style={{ marginTop: 18, fontSize: 14 }}>Walk away mid-deal and your deposit goes to the other side.</p>
        </div>
        <AgreedCard />
      </section>

      <section style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--raised)' }}>
        <div className="wrap" style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '14px 24px', flexWrap: 'wrap' }}>
          <span className="eyebrow">Recent checks</span>
          <RecentChecks />
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 72 }}>
        <span className="eyebrow">The six terms</span>
        <h2 className="serif" style={{ fontSize: 34, marginTop: 8 }}>Every account is read on the same six terms</h2>
        <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>Amount, deliverable and deadline must be stated for a deal to be on the same page. The other three only have to agree when mentioned.</p>
        <div style={{ display: 'grid', gap: 14, marginTop: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {Object.keys(TERM_LABEL).map((t) => (
            <div key={t} className="panel" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 17 }}>{TERM_LABEL[t]}</span>
                {['amount', 'deliverable', 'deadline'].includes(t) ? <span className="faint mono" style={{ fontSize: 11 }}>required</span> : <span className="faint mono" style={{ fontSize: 11 }}>if mentioned</span>}
              </div>
              <div className="faint" style={{ fontSize: 13.5, marginTop: 2 }}>{TERM_MEANS[t]}</div>
              <p className="muted" style={{ fontSize: 14.5, marginTop: 10 }}>{EXAMPLES[t]}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="wrap" style={{ paddingTop: 72 }}>
        <span className="eyebrow">How it works</span>
        <div style={{ display: 'grid', gap: 14, marginTop: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {[
            ['01', 'Write', 'Each side writes the deal in its own words, in any language and any order.'],
            ['02', 'Seal', 'Each seals a hash of its account. Neither sees the other’s until both are in, and a copied seal cannot be opened.'],
            ['03', 'Check', 'Validators compare six terms and name every difference. The result is computed from their six labels.'],
            ['04', 'Sign', 'Sign when it matches; rewrite once when it does not. Both deposits come back when both sign.'],
          ].map(([n, h, p]) => (
            <div key={n} style={{ borderTop: '1px solid var(--line-strong)', paddingTop: 14 }}>
              <span className="mono faint" style={{ fontSize: 12 }}>{n}</span>
              <h3 style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{h}</h3>
              <p className="muted" style={{ marginTop: 6, fontSize: 15 }}>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="example" className="wrap" style={{ paddingTop: 72 }}>
        <span className="eyebrow">What a difference looks like</span>
        <h2 className="serif" style={{ fontSize: 34, marginTop: 8, marginBottom: 18 }}>One term, both sides, hatched</h2>
        <DifferenceExample />
      </section>

      <section className="wrap" style={{ paddingTop: 72 }}>
        <span className="eyebrow">For creators and clients</span>
        <div style={{ display: 'grid', gap: 14, marginTop: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {[
            ['For creators and freelancers', 'Write what you think you agreed, and see where the client thinks differently, before you spend a day on it.'],
            ['For projects and clients', 'A record both sides wrote and signed, with no room for “that is not what we agreed” later.'],
            ['For traders and partners', 'A deposit that a side who walks away loses to the other, and a clean record of the terms. Samepage holds the deposit, never the payment for the work.'],
          ].map(([h, p]) => (
            <div key={h} className="panel" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>{h}</h3>
              <p className="muted" style={{ marginTop: 8, fontSize: 15 }}>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ paddingTop: 72, maxWidth: 900 }}>
        <span className="eyebrow">FAQ</span>
        <div style={{ marginTop: 14 }}>
          {FAQ.map(([q, a]) => (
            <details key={q} style={{ borderBottom: '1px solid var(--line)', padding: '14px 0' }}>
              <summary style={{ cursor: 'pointer', fontSize: 17, fontWeight: 500 }}>{q}</summary>
              <p className="muted" style={{ marginTop: 8, fontSize: 15.5 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
