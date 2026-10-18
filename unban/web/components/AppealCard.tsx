import Link from "next/link";

import { gen, hours } from "@/lib/format";
import { botAction, toMember } from "@/lib/outcome";
import type { Appeal } from "@/lib/types";
import { Ruling } from "./Ruling";

/** The live appeal card on the landing page: the quote, the rule cited, the ruling and the money. */
export function AppealCard({ a }: { a: Appeal }) {
  const quote = a.evidence.split("\n").slice(0, 2).join("\n");
  const rule = a.rules[a.rule - 1];
  const level = a.ladder[a.level - 1];
  return (
    <Link href={`/a/${a.id}`} className="card pad" style={{ display: "flex", flexDirection: "column", gap: 12, textDecoration: "none", color: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <span className="eyebrow">Appeal #{a.id} · {a.court}</span>
        <span className="ruling ANSWERED">Ruled</span>
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 17 }}>{a.case_ref}</div>
        <div className="mono dim" style={{ fontSize: 12, marginTop: 4 }}>
          rule cited {a.rule}{rule ? `, ${rule.text.toLowerCase().replace(/\.$/, "")}` : ""} · penalty applied P{a.level}{level ? ` ${level}` : ""}
        </div>
      </div>
      <div className="quote">{quote}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Ruling status={a.status} level={a.new_level} />
        <span className="muted" style={{ fontSize: 13.5, flex: 1, minWidth: 180 }}>{a.reason}</span>
      </div>
      <div style={{ display: "flex", gap: 28, borderTop: "1px solid var(--line)", paddingTop: 12, flexWrap: "wrap" }}>
        <div className="stat"><div className="n">{gen(toMember(a))} GEN</div><div className="l">to the member</div></div>
        <div className="stat"><div className="n">{a.answered_at ? hours(a.answered_at - a.filed_at) : "none"}</div><div className="l">moderator answer</div></div>
        <div className="stat"><div className="n" style={{ fontSize: 20, paddingTop: 4 }}>{botAction(a, a.ladder)}</div><div className="l">for the bot</div></div>
      </div>
    </Link>
  );
}
