import Link from "next/link";

import { gen, when } from "@/lib/format";
import { toMember } from "@/lib/outcome";
import type { AppealRow } from "@/lib/types";
import { Ruling } from "./Ruling";

export function RulingRow({ a }: { a: AppealRow }) {
  return (
    <Link href={`/a/${a.id}`} className="card" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, padding: "12px 14px", alignItems: "center", textDecoration: "none", color: "inherit" }}>
      <Ruling status={a.status} level={a.new_level} />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{a.court}</span>{" "}
        <span className="muted" style={{ fontSize: 14 }}>{a.case_ref}</span>
        {a.reason ? <span className="dim" style={{ display: "block", fontSize: 13, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.reason}</span> : null}
      </span>
      <span className="mono dim" style={{ fontSize: 12, textAlign: "right" }}>
        {toMember(a) > 0n ? <span style={{ color: "var(--amber)" }}>{gen(toMember(a))} GEN back<br /></span> : null}
        {when(a.ruled_at || a.filed_at).slice(0, 10)}
      </span>
    </Link>
  );
}
