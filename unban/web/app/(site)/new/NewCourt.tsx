"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Tx } from "@/components/Tx";
import { useWallet } from "@/components/Wallet";
import { getCourts } from "@/lib/chain";
import { toWei } from "@/lib/format";
import type { Rule } from "@/lib/types";

const TEMPLATE_RULES: Rule[] = [
  { text: "No insults or harassment of other members.", first: "P3", repeat: "P4" },
  { text: "No scam or phishing links. Any offence is a ban.", first: "P4", repeat: "P4" },
  { text: "No spam: no flooding a channel with repeated messages.", first: "P2", repeat: "P4" },
  { text: "No price talk outside #trading.", first: "P1", repeat: "P2" },
  { text: "No impersonating the team or moderators.", first: "P4", repeat: "P4" },
];
const TEMPLATE_LADDER = ["warning", "24h mute", "7-day mute", "ban"];

export function NewCourt() {
  const w = useWallet();
  const router = useRouter();
  const [name, setName] = useState("");
  const [ladder, setLadder] = useState<string[]>(TEMPLATE_LADDER);
  const [rules, setRules] = useState<Rule[]>(TEMPLATE_RULES);
  const [mods, setMods] = useState("");
  const [fee, setFee] = useState("2");
  const [comp, setComp] = useState("5");
  const [hours, setHours] = useState(48);
  const [pool, setPool] = useState("100");

  const levels = ladder.map((_, i) => `P${i + 1}`);
  const ruleChars = rules.reduce((n, r) => n + r.text.trim().length, 0);
  const modList = mods.split(/[\s,]+/).map((m) => m.trim()).filter(Boolean);

  const setRule = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const check = (): string | null => {
    if (!name.trim() || name.trim().length > 60) return "Give the court a name of at most 60 characters.";
    if (ladder.length < 1 || ladder.some((l) => !l.trim() || l.trim().length > 24)) return "Each ladder label needs 1 to 24 characters.";
    if (rules.length < 1 || rules.some((r) => !r.text.trim())) return "Every rule needs its text.";
    if (ruleChars > 2500) return "The rules are over 2,500 characters.";
    if (rules.some((r) => !levels.includes(r.first) || !levels.includes(r.repeat))) return "A rule points at a level that is not on the ladder.";
    if (rules.some((r) => Number(r.repeat.slice(1)) < Number(r.first.slice(1)))) return "A repeat offence cannot be lighter than a first offence.";
    if (modList.length < 1 || modList.length > 10 || modList.some((m) => !/^0x[0-9a-fA-F]{40}$/.test(m))) return "List 1 to 10 moderator addresses.";
    if (hours < 12 || hours > 96) return "The response window is 12 to 96 hours.";
    try {
      if (toWei(fee) <= 0n) return "The appeal fee must be above zero.";
      toWei(comp);
      toWei(pool);
    } catch (e) {
      return (e as Error).message;
    }
    return null;
  };

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <div>
          <label className="label" htmlFor="name">Community · {name.length}/60</label>
          <input id="name" className="field" maxLength={60} placeholder="Kiln Discord" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <span className="label">Penalty ladder, lightest first ({ladder.length}/6)</span>
          <div className="grid gap-2">
            {ladder.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="chip">P{i + 1}</span>
                <input className="field" maxLength={24} value={l} onChange={(e) => setLadder(ladder.map((x, j) => (j === i ? e.target.value : x)))} />
                {ladder.length > 1 && (
                  <button className="btn small" onClick={() => setLadder(ladder.slice(0, -1))} disabled={i !== ladder.length - 1} aria-label="Remove the last level">
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {ladder.length < 6 && (
            <button className="btn small mt-2" onClick={() => setLadder([...ladder, ""])}>
              Add a level
            </button>
          )}
        </div>

        <div>
          <span className="label">Rules ({rules.length}/12 · {ruleChars}/2500 characters)</span>
          <div className="grid gap-3">
            {rules.map((r, i) => (
              <div key={i} className="panel grid gap-2 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 font-mono text-[13px] text-[var(--amber)]">{i + 1}</span>
                  <textarea className="field" rows={2} value={r.text} onChange={(e) => setRule(i, { text: e.target.value })} />
                  <button className="btn small" aria-label={`Remove rule ${i + 1}`} onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 pl-5 text-[13px] text-[var(--ink-3)]">
                  first offence
                  <select className="field !w-auto" value={r.first} onChange={(e) => setRule(i, { first: e.target.value })}>
                    {levels.map((p, j) => (
                      <option key={p} value={p}>{p} {ladder[j]}</option>
                    ))}
                  </select>
                  repeat
                  <select className="field !w-auto" value={r.repeat} onChange={(e) => setRule(i, { repeat: e.target.value })}>
                    {levels.map((p, j) => (
                      <option key={p} value={p}>{p} {ladder[j]}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          {rules.length < 12 && (
            <button className="btn small mt-2" onClick={() => setRules([...rules, { text: "", first: "P1", repeat: levels[levels.length - 1] }])}>
              Add a rule
            </button>
          )}
        </div>

        <div>
          <label className="label" htmlFor="mods">Moderators · one address per line ({modList.length}/10)</label>
          <textarea id="mods" className="field" rows={3} value={mods} onChange={(e) => setMods(e.target.value)} placeholder="0x…" />
          {w.address && !modList.map((m) => m.toLowerCase()).includes(w.address.toLowerCase()) && (
            <button className="btn small mt-2" onClick={() => setMods((mods.trim() ? mods.trim() + "\n" : "") + w.address)}>
              Add my address
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Num id="fee" label="Appeal fee, GEN" value={fee} set={setFee} />
          <Num id="comp" label="Compensation, GEN" value={comp} set={setComp} />
          <div>
            <label className="label" htmlFor="hours">Response window · {hours} h</label>
            <input id="hours" type="range" min={12} max={96} step={6} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full accent-[#fbbf24]" />
          </div>
          <Num id="pool" label="First pool funding, GEN" value={pool} set={setPool} />
        </div>

        <Tx
          label="Open the court"
          validate={check}
          call={() => ({
            functionName: "open_court",
            args: [
              name.trim(),
              JSON.stringify(rules.map((r) => ({ text: r.text.trim(), first: r.first, repeat: r.repeat }))),
              JSON.stringify(ladder.map((l) => l.trim())),
              JSON.stringify(modList),
              toWei(fee),
              toWei(comp),
              hours,
            ],
            value: toWei(pool),
          })}
          onDone={async () => {
            const all = await getCourts();
            const mine = all.courts.find((c) => c.owner.toLowerCase() === (w.address ?? "").toLowerCase());
            router.push(mine ? `/c/${mine.id}` : "/courts");
          }}
        />
      </div>

      <aside className="flex flex-col gap-4">
        <div className="panel p-5 text-[14px] text-[var(--ink-2)]">
          <span className="eyebrow">How the rules are held</span>
          <ul className="mt-3 grid list-disc gap-2 pl-5">
            <li>A rule that is not written cannot be broken. Write the conduct, not the intent.</li>
            <li>Rules and the ladder freeze while any appeal is open, and a change only judges bans made after the day it was written.</li>
            <li>Appeals and evidence are public. Write rules so evidence never needs personal data.</li>
            <li>The pool can be reclaimed by you when no appeal is open; reserved compensation never can.</li>
          </ul>
        </div>
        <div className="panel p-5 text-[14px] text-[var(--ink-2)]">
          <span className="eyebrow">Bot setup</span>
          <p className="mt-3">After the court is open, run the read-only bot with your server&apos;s bot token. It polls rulings and lifts or shortens bans; it holds no wallet key.</p>
          <pre className="quote mt-3">UNBAN_CONTRACT=0x… UNBAN_COURT=1 DISCORD_TOKEN=… DISCORD_GUILD=… npm start</pre>
          <Link className="link mt-3 inline-block" href="/docs/concepts/bot">Bot configuration</Link>
        </div>
      </aside>
    </div>
  );
}

function Num({ id, label, value, set }: { id: string; label: string; value: string; set: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="field" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );
}
