import Link from "next/link";

import { Empty, Unavailable } from "@/components/Unavailable";
import { deployed } from "@/lib/deployment";
import { gen, hours } from "@/lib/format";
import { allCourts, why } from "@/lib/read";
import type { Court } from "@/lib/types";

export const revalidate = 15;
export const metadata = { title: "Courts" };

export default async function Courts() {
  let courts: Court[] = [];
  let error = "";
  if (deployed) {
    try {
      courts = await allCourts();
    } catch (e) {
      error = why(e);
    }
  }
  return (
    <section className="wrap" style={{ paddingTop: 40, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">Courts</span>
          <h1 style={{ margin: "6px 0 0", fontSize: 36 }}>Communities with a written appeal process</h1>
        </div>
        <Link href="/new" className="btn solid sm" style={{ marginLeft: "auto" }}>Open a court</Link>
      </div>
      {!deployed ? (
        <Unavailable message="The contract this site reads has not been deployed yet." deployLink />
      ) : error ? (
        <Unavailable message={error} />
      ) : courts.length === 0 ? (
        <Empty>No court has been opened yet. <Link href="/new" style={{ color: "var(--amber)" }}>Open the first one</Link>.</Empty>
      ) : (
        <div className="grid cols-3">
          {courts.map((c) => (
            <Link key={c.id} href={`/c/${c.id}`} className="card pad" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="eyebrow">Court #{c.id}</span>
              <span style={{ fontSize: 20, fontWeight: 600 }}>{c.name}</span>
              <span className="muted" style={{ fontSize: 13.5 }}>{c.rules.length} rules · ladder P1 to P{c.ladder.length} · {c.mods.length} moderator{c.mods.length === 1 ? "" : "s"}</span>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <div className="stat"><div className="n" style={{ fontSize: 20 }}>{c.appeals}</div><div className="l">appeals</div></div>
                <div className="stat"><div className="n" style={{ fontSize: 20 }}>{c.overturned + c.defaulted}</div><div className="l">for the member</div></div>
                <div className="stat"><div className="n" style={{ fontSize: 20 }}>{gen(c.pool)}</div><div className="l">GEN pool</div></div>
                <div className="stat"><div className="n" style={{ fontSize: 20 }}>{c.answered ? hours(c.avg_answer_seconds) : "–"}</div><div className="l">avg answer</div></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
