import Link from "next/link";

import { FundPool } from "@/components/FundPool";
import { RulesView } from "@/components/RulesView";
import { RulingRow } from "@/components/RulingRow";
import { Empty, Unavailable } from "@/components/Unavailable";
import { CONTRACT, deployed } from "@/lib/deployment";
import { gen, hours, short } from "@/lib/format";
import { addressUrl } from "@/lib/network";
import { getCourt, listAppeals, why } from "@/lib/read";
import type { AppealRow, Court } from "@/lib/types";

export const revalidate = 15;

export default async function CourtPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  let court: Court | null = null;
  let appeals: AppealRow[] = [];
  let error = "";
  if (!deployed) error = "The contract this site reads has not been deployed yet.";
  else if (!Number.isInteger(id) || id < 1) error = "That is not a court number.";
  else {
    try {
      court = await getCourt(id);
      appeals = (await listAppeals(id, "", 0, 12)).items;
    } catch (e) {
      error = why(e);
    }
  }
  if (!court) {
    return <section className="wrap" style={{ paddingTop: 40 }}><Unavailable message={error} deployLink={!deployed} /></section>;
  }
  const resolved = court.upheld + court.reduced + court.overturned + court.defaulted;
  return (
    <section className="wrap" style={{ paddingTop: 40, display: "grid", gap: 28 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">Court #{court.id} · rules version {court.versions}, in force for bans after {court.rules_from}</span>
          <h1 style={{ margin: "6px 0 0", fontSize: 38 }}>{court.name}</h1>
        </div>
        <Link href={`/c/${court.id}/appeal`} className="btn solid" style={{ marginLeft: "auto" }}>File an appeal</Link>
      </div>

      <div className="grid cols-2" style={{ gap: 28 }}>
        <div style={{ display: "grid", gap: 28, alignContent: "start" }}>
          <div>
            <span className="eyebrow">Rules and penalty ladder</span>
            <div style={{ marginTop: 10 }}><RulesView rules={court.rules} ladder={court.ladder} /></div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <span className="eyebrow">Recent appeals</span>
            {appeals.length ? appeals.map((a) => <RulingRow key={a.id} a={a} />) : <Empty>No appeal has been filed in this court yet.</Empty>}
          </div>
        </div>

        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="card pad" style={{ display: "grid", gap: 10 }}>
            <span className="eyebrow">Money</span>
            <Row k="Appeal fee" v={`${gen(court.appeal_fee)} GEN`} />
            <Row k="Compensation" v={`${gen(court.compensation)} GEN`} />
            <Row k="Pool" v={`${gen(court.pool)} GEN`} strong />
            <Row k="Reserved for open appeals" v={`${gen(court.reserved)} GEN`} />
            {BigInt(court.pool) < BigInt(court.compensation) ? (
              <p className="note" style={{ margin: 0, fontSize: 13 }}>The pool holds less than one compensation, so a new appeal would only win its fee back.</p>
            ) : null}
            <FundPool contract={CONTRACT} courtId={court.id} />
          </div>
          <div className="card pad" style={{ display: "grid", gap: 10 }}>
            <span className="eyebrow">Record</span>
            <Row k="Appeals" v={String(court.appeals)} />
            <Row k="Open now" v={String(court.open_appeals)} />
            <Row k="Overturned" v={String(court.overturned)} />
            <Row k="Reduced" v={String(court.reduced)} />
            <Row k="Upheld" v={String(court.upheld)} />
            <Row k="Defaulted" v={String(court.defaulted)} />
            <Row k="For the member" v={resolved ? `${Math.round(((court.overturned + court.defaulted) / resolved) * 100)}%` : "–"} />
            <Row k="Average answer" v={court.answered ? hours(court.avg_answer_seconds) : "–"} />
            <Row k="Response window" v={`${court.response_hours} h`} />
          </div>
          <div className="card pad" style={{ display: "grid", gap: 8 }}>
            <span className="eyebrow">Moderators</span>
            {court.mods.map((m) => (
              <a key={m} className="mono muted" style={{ fontSize: 12.5 }} href={addressUrl(m)} target="_blank" rel="noreferrer">{short(m)}</a>
            ))}
            <span className="dim" style={{ fontSize: 12.5 }}>Owner <a className="mono" href={addressUrl(court.owner)} target="_blank" rel="noreferrer">{short(court.owner)}</a></span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
      <span className="muted">{k}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: strong ? "var(--amber)" : undefined }}>{v}</span>
    </div>
  );
}
