import Link from "next/link";

import { AppealCard } from "@/components/AppealCard";
import { OUTCOMES, Ruling } from "@/components/Ruling";
import { RulingRow } from "@/components/RulingRow";
import { Empty, Unavailable } from "@/components/Unavailable";
import { deployed } from "@/lib/deployment";
import { getAppeal, listAppeals, why } from "@/lib/read";
import type { Appeal, AppealRow } from "@/lib/types";

export const revalidate = 15;

const STEPS = [
  { n: "01", t: "Rules", d: "The community writes numbered rules and a penalty ladder once, lists its moderators and funds a small pool." },
  { n: "02", t: "Appeal", d: "A banned member files the case and a statement, with the appeal fee." },
  { n: "03", t: "Evidence", d: "A moderator answers with the rule, the penalty applied and the quoted messages. The member may reply once." },
  { n: "04", t: "Ruling", d: "GenLayer validators rule by the written rules, balances settle, and the bot applies the result." },
];

const FAQ = [
  {
    q: "Who decides?",
    a: "Several GenLayer validators each read the same rules and the same record and ask a model the same question. A ruling is stored only when they agree on the verdict and, for a reduced ban, on the level. The reason sentence is the leader's and is never compared.",
  },
  {
    q: "What if the quote is fake?",
    a: "The judge cannot read the chat, so it rules on the record as both sides left it. The quotes sit in public next to the moderator's address, and the member's reply is where a quote gets disputed. A record that contradicts itself, such as quotes from a different handle, is overturned.",
  },
  {
    q: "What can the bot do?",
    a: "It reads rulings and applies them in the server with the server's own bot token: lift a ban, or replace it with the ladder's penalty. It holds no wallet key and signs nothing.",
  },
  {
    q: "Which network?",
    a: "GenLayer Studio Next, chain 61997. The appeal fee and compensation are test GEN; the faucet on every form gives you some.",
  },
  {
    q: "Can a community change its rules to win an appeal?",
    a: "No. Rules are frozen while any appeal is open, and a change applies only to bans dated after it. Every appeal is judged by the rules in force when the ban happened.",
  },
];

export default async function Home() {
  let rulings: AppealRow[] = [];
  let hero: Appeal | null = null;
  let error = "";
  if (deployed) {
    try {
      rulings = (await listAppeals(0, "DONE", 0, 8)).items;
      const pick = rulings.find((r) => r.status === "OVERTURNED") ?? rulings.find((r) => r.status !== "DEFAULTED");
      if (pick) hero = await getAppeal(pick.id);
    } catch (e) {
      error = why(e);
    }
  }

  return (
    <>
      <section className="wrap" style={{ paddingTop: 56, paddingBottom: 40 }}>
        <div className="grid hero" style={{ gap: 40, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <span className="eyebrow amber">Ban appeals, ruled on GenLayer</span>
            <h1 style={{ fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.02, letterSpacing: "-.03em", margin: 0, fontWeight: 700 }}>
              Every ban gets <span style={{ color: "var(--amber)" }}>a fair second look.</span>
            </h1>
            <p className="muted" style={{ fontSize: 17, lineHeight: 1.6, margin: 0, maxWidth: 520 }}>
              Communities write their rules and penalties once. Banned members appeal with a small fee, moderators show the
              evidence, and GenLayer validators rule by the written rules. A bot applies the result.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/courts" className="btn solid">Browse courts</Link>
              <Link href="/new" className="btn">Open a court</Link>
            </div>
            <span className="mono dim" style={{ fontSize: 12 }}>Right about the ban? The fee comes back, with compensation.</span>
          </div>
          <div>
            {hero ? (
              <AppealCard a={hero} />
            ) : error ? (
              <Unavailable message={error} />
            ) : !deployed ? (
              <Unavailable message="The contract this site reads has not been deployed yet, so there is no live appeal to show." deployLink />
            ) : (
              <Empty>No appeal has been ruled yet. The first ruling will appear here, read from the chain.</Empty>
            )}
          </div>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 48 }}>
        <div style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="eyebrow">Recent rulings</span>
          {rulings.length ? (
            <div className="grid" style={{ gap: 8 }}>
              {rulings.slice(0, 4).map((r) => <RulingRow key={r.id} a={r} />)}
            </div>
          ) : (
            <span className="dim" style={{ fontSize: 14 }}>{error || "No rulings yet. Upheld bans will show here too: the court is not a soft touch."}</span>
          )}
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 56 }}>
        <span className="eyebrow">How it works</span>
        <div className="grid cols-4" style={{ marginTop: 16 }}>
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="mono" style={{ color: "var(--amber)", fontSize: 13 }}>{s.n}</div>
              <h3 style={{ margin: "6px 0", fontSize: 20 }}>{s.t}</h3>
              <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 56 }}>
        <span className="eyebrow">Who pays when</span>
        <h2 style={{ fontSize: 30, margin: "8px 0 16px" }}>The money follows the ruling</h2>
        <div className="card tablewrap">
          <table className="table">
            <thead><tr><th>Ruling</th><th>Meaning</th><th>Money</th><th>The bot</th></tr></thead>
            <tbody>
              {OUTCOMES.map((o) => (
                <tr key={o.status}>
                  <td><Ruling status={o.status} level={o.status === "REDUCED" ? "P2" : undefined} /></td>
                  <td className="muted">{o.meaning}</td>
                  <td>{o.money}</td>
                  <td className="muted">{o.bot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dim" style={{ fontSize: 13, marginTop: 10 }}>
          Compensation is reserved from the pool when an appeal is filed, so a ruling for the member is never unpaid. If the pool is
          empty the appeal still runs, with the fee as the only money at stake, and the form says so.
        </p>
      </section>

      <section className="wrap" style={{ paddingBottom: 56 }}>
        <div className="card pad" style={{ display: "grid", gap: 20 }}>
          <span className="eyebrow amber">For moderators</span>
          <div className="grid cols-3">
            <div><h3 style={{ margin: "0 0 6px" }}>Write the rules once</h3><p className="muted" style={{ margin: 0, fontSize: 14 }}>Up to twelve numbered rules and a ladder of up to six penalties, each rule with a level for a first offence and for a repeat.</p></div>
            <div><h3 style={{ margin: "0 0 6px" }}>Answer with evidence</h3><p className="muted" style={{ margin: 0, fontSize: 14 }}>Pick the rule and the level from the court&apos;s own lists and paste the exact messages. No arguing in DMs.</p></div>
            <div><h3 style={{ margin: "0 0 6px" }}>Let the ruling back you up</h3><p className="muted" style={{ margin: 0, fontSize: 14 }}>A good call is upheld in public. An appeal nobody answers defaults to the member, so answer in time.</p></div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/mod" className="btn solid sm">Open the moderator desk</Link>
            <Link href="/docs/getting-started/quickstart" className="btn sm">Quickstart</Link>
          </div>
        </div>
      </section>

      <section className="wrap">
        <span className="eyebrow">Questions</span>
        <div className="grid" style={{ marginTop: 14, gap: 10 }}>
          {FAQ.map((f) => (
            <details key={f.q} className="card pad">
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.q}</summary>
              <p className="muted" style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.65 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
