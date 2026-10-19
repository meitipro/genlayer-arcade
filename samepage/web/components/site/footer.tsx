import Link from 'next/link';
import { CONTRACT, addressUrl, DEPLOY_TX, txUrl } from '@/lib/chain';
import { REPO_URL } from '@/lib/shared';

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 96 }}>
      <div className="wrap" style={{ padding: '32px 24px', display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', fontSize: 14 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>samepage</div>
          <p className="faint">Two accounts of one deal, checked before anyone signs. Built on GenLayer Studio Next, chain 61997.</p>
        </div>
        <div className="muted" style={{ display: 'grid', gap: 6 }}>
          <span className="eyebrow">Contract</span>
          {CONTRACT ? (
            <a className="link mono" href={addressUrl(CONTRACT)} target="_blank" rel="noreferrer">{CONTRACT}</a>
          ) : (
            <span className="faint">Not deployed in this build</span>
          )}
          {DEPLOY_TX ? <a className="link" href={txUrl(DEPLOY_TX)} target="_blank" rel="noreferrer">Deploy transaction</a> : null}
        </div>
        <div className="muted" style={{ display: 'grid', gap: 6 }}>
          <span className="eyebrow">Links</span>
          <Link href="/docs">Docs</Link>
          <Link href="/docs/more/evaluation">Evaluation results</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a>
          <Link href="/llms.txt">llms.txt</Link>
        </div>
      </div>
    </footer>
  );
}
