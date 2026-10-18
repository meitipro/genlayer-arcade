import type { Rule } from "@/lib/types";

export function RulesView({ rules, ladder }: { rules: Rule[]; ladder: string[] }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {rules.map((r, i) => (
          <li key={i} className="card" style={{ padding: "10px 14px", display: "grid", gridTemplateColumns: "28px 1fr", gap: 10 }}>
            <span className="mono" style={{ color: "var(--amber)" }}>{i + 1}</span>
            <span>
              {r.text}
              <span className="mono dim" style={{ display: "block", fontSize: 12, marginTop: 4 }}>
                first offence P{r.first} {ladder[r.first - 1]} · repeat P{r.repeat} {ladder[r.repeat - 1]}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ladder.map((l, i) => (
          <span key={i} className="pill">P{i + 1} {l}</span>
        ))}
      </div>
    </div>
  );
}
