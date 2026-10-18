import Link from "next/link";

import { AppealActions } from "@/components/AppealActions";
import { Ruling } from "@/components/Ruling";
import { Unavailable } from "@/components/Unavailable";
import { CONTRACT, deployed } from "@/lib/deployment";
import { gen, hours, short, when } from "@/lib/format";
import { addressUrl } from "@/lib/network";
import { botAction, toMember } from "@/lib/outcome";
import { getAppeal, getCourt, why } from "@/lib/read";
import type { Appeal, Court } from "@/lib/types";

export const revalidate = 15;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Appeal #${(await params).id}` };
}

export default async function AppealPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  let a: Appeal | null = null;
  let court: Court | null = null;
  let error = deployed ? "" : "The contract this site reads has not been deployed yet.";
  if (deployed) {
    try {
      a = await getAppeal(id);
      court = await getCourt(a.court_id);
    } catch (e) {
      error = why(e);
    }
  }
  if (!a || !court) return <section className="wrap" style={{ paddingTop: 40 }}><Unavailable message={error} deployLink={!deployed} /></section>;
  const rule = a.rules[a.rule - 1];
  const resolved = !["FILED", "ANSWERED"].includes(a.status);

  return (
    <section className="wrap" style={{ paddingTop: 40, display: "grid", gap: 24 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="eyebrow">Appeal #{a.id} · <Link href={`/c/${a.court_id}`}>{a.court}</Link></span>
          <Ruling status={a.status} level={a.new_level} />
        </div>
        <h1 style={{ margin: 0, fontSize: 32 }}>{a.case_ref}</h1>
        <span className="mono dim" style={{ fontSize: 12.5 }}>judged by the rules in force for bans after {a.rules_from} · {a.earlier} earlier upheld or reduced ruling{a.earlier === 1 ? "" : "s"} for this member here</span>
      </div>

      <div className="grid cols-2" style={{ gap: 24 }}>
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <Block title="Member's appeal" meta={`${short(a.member)} · ${when(a.filed_at)}`} href={addressUrl(a.member)}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{a.statement}</p>
          </Block>

          {a.answered_at ? (
            <Block title="Moderator's answer" meta={`${short(a.moderator)} · ${hours(a.answered_at - a.filed_at)} later`} href={addressUrl(a.moderator)}>
              <p style={{ margin: "0 0 10px" }}>
                Rule cited <strong>{a.rule}{rule ? `, ${rule.text}` : ""}</strong> · penalty applied <strong>P{a.level} {a.ladder[a.level - 1]}</strong>
              </p>
              <div className="quote">{a.evidence}</div>
            </Block>
          ) : (
            <Block title="Moderator's answer" meta={`due by ${when(a.respond_by)}`}><p className="dim" style={{ margin: 0 }}>Not answered yet.</p></Block>
          )}

          {a.reply ? (
            <Block title="Member's reply" meta={`once, ${when(a.replied_at)}`}><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{a.reply}</p></Block>
          ) : a.answered_at ? (
            <Block title="Member's reply" meta={`window until ${when(a.reply_by)}`}><p className="dim" style={{ margin: 0 }}>No reply.</p></Block>
          ) : null}

          {resolved ? (
            <div className="card pad hl" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <Ruling status={a.status} level={a.new_level} />
                <span className="mono dim" style={{ fontSize: 12 }}>{a.status === "DEFAULTED" ? "on chain time" : "validators agreed"} · {when(a.ruled_at)}</span>
              </div>
              <p style={{ margin: 0 }}>{a.reason}</p>
              {a.status === "REDUCED" ? <p className="muted" style={{ margin: 0, fontSize: 14 }}>New penalty: {a.new_level} {a.ladder[Number(a.new_level.slice(1)) - 1]}</p> : null}
            </div>
          ) : null}
        </div>

        <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div className="card pad" style={{ display: "grid", gap: 10 }}>
            <span className="eyebrow">{resolved ? "Settlement" : "What happens next"}</span>
            {resolved ? (
              <>
                <Line k="Appeal fee back" v={`${a.status === "UPHELD" ? "0" : gen(a.fee)} GEN`} />
                <Line k="Compensation" v={`${a.status === "OVERTURNED" || a.status === "DEFAULTED" ? gen(a.reserved) : "0"} GEN`} />
                <Line k="To the member" v={`${gen(toMember(a))} GEN`} strong />
                <Line k="Member's balance now" v={`${gen(a.member_balance)} GEN`} />
              </>
            ) : (
              <>
                <Line k="Fee paid" v={`${gen(a.fee)} GEN`} />
                <Line k="Compensation reserved" v={`${gen(a.reserved)} GEN`} />
              </>
            )}
            <AppealActions contract={CONTRACT} a={a} mods={court.mods} />
          </div>
          <div className="card pad" style={{ display: "grid", gap: 8 }}>
            <span className="eyebrow">For the {a.court} bot</span>
            <span style={{ fontWeight: 600 }}>{botAction(a, a.ladder)}</span>
            <span className="dim" style={{ fontSize: 12.5 }}>The bot reads this ruling with list_appeals and applies it with the server&apos;s own bot token. It holds no wallet key and signs nothing.</span>
          </div>
          <div className="card pad" style={{ display: "grid", gap: 8 }}>
            <span className="eyebrow">{court.name}</span>
            <Line k="Appeals" v={String(court.appeals)} />
            <Line k="Overturned or defaulted" v={String(court.overturned + court.defaulted)} />
            <Line k="Average answer" v={court.answered ? hours(court.avg_answer_seconds) : "–"} />
            <Line k="Pool" v={`${gen(court.pool)} GEN`} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function Block({ title, meta, href, children }: { title: string; meta: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="card pad" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span className="eyebrow">{title}</span>
        {href ? <a className="mono dim" style={{ fontSize: 11.5 }} href={href} target="_blank" rel="noreferrer">{meta}</a> : <span className="mono dim" style={{ fontSize: 11.5 }}>{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
      <span className="muted">{k}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: strong ? "var(--amber)" : undefined }}>{v}</span>
    </div>
  );
}
