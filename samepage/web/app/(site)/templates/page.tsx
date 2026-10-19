import type { Metadata } from 'next';
import { TEMPLATES } from '@/lib/templates';
import { TERM_LABEL } from '@/components/site/terms';

export const metadata: Metadata = { title: 'Templates', description: 'Term hints for common deals: promotions, design gigs, OTC trades and ambassador roles.' };

export default function Templates() {
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <span className="eyebrow">Templates</span>
      <h1 className="serif" style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginTop: 6 }}>What to settle, for the deals people make in DMs</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 680 }}>Term hints, never prefilled accounts. A template the other side wrote is the framing Samepage exists to avoid, so these are the questions each side answers in their own words.</p>
      <div style={{ display: 'grid', gap: 18, marginTop: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {TEMPLATES.map((t) => (
          <section key={t.slug} className="panel" style={{ padding: 20, display: 'grid', gap: 12, alignContent: 'start' }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t.name}</h2>
              <div className="faint" style={{ fontSize: 14 }}>{t.who}</div>
            </div>
            <dl style={{ display: 'grid', gap: 8, fontSize: 14.5 }}>
              {Object.entries(t.hints).map(([term, hint]) => (
                <div key={term}>
                  <dt style={{ fontWeight: 500 }}>{TERM_LABEL[term]}</dt>
                  <dd className="muted">{hint}</dd>
                </div>
              ))}
            </dl>
            <div><a className="btn btn-sm" href={`/new?template=${t.slug}`}>Open a page with these hints</a></div>
          </section>
        ))}
      </div>
    </div>
  );
}
