import { TERMS, REQUIRED, type Round, type Page, short } from '@/lib/chain';

export const TERM_LABEL: Record<string, string> = {
  amount: 'Amount',
  deliverable: 'Deliverable',
  deadline: 'Deadline',
  payment: 'Payment',
  rights: 'Rights',
  cancellation: 'Cancellation',
};

export const TERM_MEANS: Record<string, string> = {
  amount: 'the price, the currency and any quantity',
  deliverable: 'what exactly is delivered or done',
  deadline: 'when it is due',
  payment: 'when and how payment is made',
  rights: 'who owns or may use the result',
  cancellation: 'what happens if either side backs out',
};

/** The six statuses of one checked round, differences first, with the leader's notes as a reading aid. */
export function TermTable({ round, differencesFirst = true }: { round: Round; differencesFirst?: boolean }) {
  const rows = TERMS.map((t, i) => ({ term: t, status: round.statuses[i] ?? '', note: round.notes?.[t] ?? '' }));
  const order = { DIFFER: 0, ABSENT: 2, MATCH: 1 } as Record<string, number>;
  if (differencesFirst) rows.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  return (
    <div className="panel" style={{ overflowX: 'auto' }}>
      <table className="terms">
        <thead>
          <tr>
            <th style={{ width: 150 }}>Term</th>
            <th>What the two accounts say (leader&apos;s note)</th>
            <th style={{ width: 96, textAlign: 'right' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.term} className={`row-${r.status}`}>
              <td>
                <div style={{ fontWeight: 500 }}>{TERM_LABEL[r.term]}</div>
                {REQUIRED.includes(r.term) ? <div className="faint mono" style={{ fontSize: 11 }}>required</div> : null}
              </td>
              <td className={r.status === 'ABSENT' ? 'faint' : ''}>
                {r.note || (r.status === 'ABSENT' ? 'Neither account states it.' : '')}
                {round.split?.includes(r.term) ? (
                  <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
                    Read one way in one order and another way in the other, so stored as DIFFER.
                  </div>
                ) : null}
              </td>
              <td style={{ textAlign: 'right' }}>
                <span className={`st st-${r.status}`}>{r.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Both full accounts, side by side. This, with the six statuses, is the record. */
export function Accounts({ page, round, me }: { page: Page; round: Round; me?: string }) {
  const label = (who: string, side: 'opener' | 'counterparty') =>
    me && me.toLowerCase() === who.toLowerCase() ? 'Your account' : `${side === 'opener' ? 'Opener' : 'Counterparty'} ${short(who)}`;
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {([
        ['a', page.opener, 'opener'],
        ['b', page.counterparty, 'counterparty'],
      ] as const).map(([k, who, side]) => {
        const text = k === 'a' ? round.a_text : round.b_text;
        return (
          <div key={k} className="panel" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{label(who, side)}</div>
            {text ? <div className="account-text">{text}</div> : <div className="faint">Not opened.</div>}
          </div>
        );
      })}
    </div>
  );
}
