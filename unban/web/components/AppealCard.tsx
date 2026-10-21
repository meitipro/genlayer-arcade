import Link from "next/link";

import { duration, gen } from "@/lib/format";
import type { Appeal } from "@/lib/types";

import { Verdict } from "./Badge";

/** The live appeal card: the quote, the rule cited, the ruling and the money, readable in ten seconds. */
export function AppealCard({ a }: { a: Appeal }) {
  const ruled = a.status !== "FILED" && a.status !== "ANSWERED";
  const lines = a.evidence.split("\n").slice(0, 2).join("\n");
  return (
    <Link href={`/a/${a.id}`} className="panel block p-6 transition hover:border-[var(--line-2)]">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">
          Appeal #{a.id} · {a.court_name}
        </span>
        <Verdict status={a.status} level={a.new_level} />
      </div>
      <h3 className="mt-4 text-[19px] font-semibold leading-snug">{a.case_ref}</h3>
      {a.rule > 0 && (
        <p className="mt-1 font-mono text-[12px] text-[var(--ink-3)]">
          rule cited {a.rule}, {a.rule_text.toLowerCase().replace(/\.$/, "")} · penalty applied {a.level} {a.level_label}
        </p>
      )}
      {lines && <div className="quote mt-4">{lines}</div>}
      {a.reason && <p className="mt-4 text-[14px] text-[var(--ink-2)]">{a.reason}</p>}
      {ruled && (
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-[var(--line)] pt-4">
          <div>
            <div className="text-[22px] font-semibold">{gen(a.to_member)} GEN</div>
            <div className="eyebrow">to the member</div>
          </div>
          <div>
            <div className="text-[22px] font-semibold">{a.answered_at ? duration(a.answered_at - a.filed_at) : "none"}</div>
            <div className="eyebrow">moderator answer</div>
          </div>
          <div>
            <div className="text-[22px] font-semibold">{a.status === "UPHELD" ? "Stays" : a.status === "REDUCED" ? a.new_level : "Lifted"}</div>
            <div className="eyebrow">the ban</div>
          </div>
        </div>
      )}
    </Link>
  );
}
