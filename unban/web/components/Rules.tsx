import type { Rule } from "@/lib/types";

export function RulesTable({ rules, ladder }: { rules: Rule[]; ladder: string[] }) {
  const label = (level: string) => ladder[Number(level.slice(1)) - 1] ?? level;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <ol className="grid gap-3">
        {rules.map((r, i) => (
          <li key={i} className="panel p-4">
            <div className="flex items-start gap-3">
              <span className="font-mono text-[13px] text-[var(--amber)]">{i + 1}</span>
              <div>
                <p className="text-[15px]">{r.text}</p>
                <p className="mt-1 font-mono text-[12px] text-[var(--ink-3)]">
                  first offence {r.first} {label(r.first)} · repeat {r.repeat} {label(r.repeat)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="panel h-fit p-4">
        <span className="eyebrow">Penalty ladder, lightest first</span>
        <ol className="mt-3 grid gap-2">
          {ladder.map((l, i) => (
            <li key={i} className="flex items-center gap-3 text-[14px]">
              <span className="chip">P{i + 1}</span> {l}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
