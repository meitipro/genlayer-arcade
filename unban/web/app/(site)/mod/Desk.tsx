"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Verdict } from "@/components/Badge";
import { Tx } from "@/components/Tx";
import { useWallet } from "@/components/Wallet";
import { getAppeal, getCourts, listAppeals } from "@/lib/chain";
import { IS_LIVE } from "@/lib/config";
import { gen, left, when } from "@/lib/format";
import { humanError } from "@/lib/human";
import type { Appeal, AppealRow, Court } from "@/lib/types";

export function Desk() {
  const w = useWallet();
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [waiting, setWaiting] = useState<AppealRow[]>([]);
  const [past, setPast] = useState<AppealRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Appeal | null>(null);

  const reload = useCallback(async () => {
    if (!w.address || !IS_LIVE) return;
    setError(null);
    try {
      const all = await getCourts();
      const me = w.address.toLowerCase();
      const mine = all.courts.filter((c) => c.mods.includes(me));
      setCourts(mine);
      const lists = await Promise.all(mine.map((c) => listAppeals(c.id, "filed", 0, 50)));
      setWaiting(lists.flat().sort((a, b) => a.filed_at - b.filed_at));
      const ruled = await Promise.all(mine.map((c) => listAppeals(c.id, "ruled", 0, 10)));
      setPast(ruled.flat().sort((a, b) => b.ruled_at - a.ruled_at).slice(0, 10));
    } catch (e) {
      setError(humanError(e).text);
    }
  }, [w.address]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!IS_LIVE) return <p className="note grey mt-6">The contract address is not configured on this deployment yet.</p>;
  if (!w.address)
    return (
      <div className="mt-6 grid max-w-xl gap-4">
        <p className="text-[15px] text-[var(--ink-2)]">Connect the wallet a court lists as a moderator. The desk shows the appeals waiting in your courts, oldest first, with the hours left before each is granted by default.</p>
        <button className="btn primary self-start" onClick={() => w.connect().catch((e) => setError(humanError(e).text))}>
          Connect wallet
        </button>
        {error && <p className="note bad">{error}</p>}
      </div>
    );

  return (
    <div className="mt-2">
      <p className="text-[14px] text-[var(--ink-3)]">
        {courts === null ? "Reading your courts…" : courts.length === 0 ? "This address is not a moderator of any court." : `${courts.map((c) => c.name).join(", ")} · ${waiting.length} appeal${waiting.length === 1 ? "" : "s"} waiting`}
      </p>
      {error && <p className="note bad mt-4">{error}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-3">
          {waiting.length === 0 && courts !== null && <div className="panel p-4 text-[14px] text-[var(--ink-3)]">Nothing is waiting for an answer.</div>}
          {waiting.map((r) => (
            <button
              key={r.id}
              className={`panel p-4 text-left ${picked?.id === r.id ? "border-[var(--amber)]" : ""}`}
              onClick={() => getAppeal(r.id).then(setPicked).catch((e) => setError(humanError(e).text))}
            >
              <div className="flex items-center justify-between gap-2">
                <b className="text-[14px]">#{r.id} {r.court_name}</b>
                <span className={`font-mono text-[12px] ${r.respond_by - Date.now() / 1000 < 12 * 3600 ? "text-[var(--amber)]" : "text-[var(--ink-3)]"}`}>{left(r.respond_by)}</span>
              </div>
              <p className="mt-1 truncate text-[13px] text-[var(--ink-2)]">{r.case_ref}</p>
            </button>
          ))}
          <div className="panel p-4 text-[13px] text-[var(--ink-3)]">
            <span className="eyebrow">If nobody answers</span>
            <p className="mt-2">The appeal is granted by default: the ban is lifted and the reserved compensation goes to the member.</p>
          </div>
        </div>
        <div>{picked ? <Answer a={picked} onDone={() => { setPicked(null); reload(); }} /> : <div className="panel p-6 text-[14px] text-[var(--ink-3)]">Pick an appeal to answer it.</div>}</div>
      </div>

      {past.length > 0 && (
        <div className="mt-12">
          <span className="eyebrow">Past rulings in your courts</span>
          <div className="mt-4 grid gap-2">
            {past.map((r) => (
              <Link key={r.id} href={`/a/${r.id}`} className="panel flex items-center gap-3 p-3 text-[14px]">
                <Verdict status={r.status} level={r.new_level} />
                <span className="truncate">{r.case_ref}</span>
                <span className="ml-auto font-mono text-[12px] text-[var(--ink-3)]">{when(r.ruled_at)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Answer({ a, onDone }: { a: Appeal; onDone: () => void }) {
  const [rule, setRule] = useState(0);
  const [level, setLevel] = useState("");
  const [evidence, setEvidence] = useState("");
  const chosen = rule > 0 ? a.rules[rule - 1] : null;
  const appliedIndex = level ? Number(level.slice(1)) : 0;
  const firstIndex = chosen ? Number(chosen.first.slice(1)) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="label">Rule cited</span>
        <div className="flex flex-wrap gap-2">
          {a.rules.map((r, i) => (
            <button key={i} className="chip" aria-pressed={rule === i + 1} onClick={() => setRule(i + 1)} title={r.text}>
              {i + 1} {r.text.split(/[.:]/)[0].slice(0, 22)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Penalty applied</span>
        <div className="flex flex-wrap gap-2">
          {a.ladder.map((l, i) => (
            <button key={i} className="chip" aria-pressed={level === `P${i + 1}`} onClick={() => setLevel(`P${i + 1}`)}>
              P{i + 1} {l}
            </button>
          ))}
        </div>
      </div>
      {chosen && (
        <p className="note">
          Ladder for rule {rule}: first offence {chosen.first}, repeat {chosen.repeat}.
          {appliedIndex > firstIndex && " Unless the record shows a repeat, expect the validators to reduce this to the first-offence level."}
        </p>
      )}
      <div>
        <label className="label" htmlFor="evidence">Evidence, quoted messages · {evidence.length}/1500</label>
        <textarea id="evidence" className="field" rows={6} maxLength={1500} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="[Oct 8 11:20] mirrr: gm (14 times in 2 minutes)" />
      </div>
      <Tx
        label="Submit answer"
        validate={() => (!rule ? "Pick the rule cited." : !level ? "Pick the penalty applied." : !evidence.trim() ? "Quote the messages." : null)}
        call={() => ({ functionName: "respond", args: [a.id, rule, level, evidence.trim()] })}
        onDone={onDone}
      >
        <p className="text-[12px] text-[var(--ink-3)]">Public, next to your address.</p>
      </Tx>
      <div className="panel p-4">
        <div className="flex items-center justify-between">
          <span className="eyebrow">The appeal you are answering, #{a.id}</span>
          <span className="font-mono text-[12px] text-[var(--ink-3)]">banned {a.banned_on} · fee {gen(a.fee)} GEN</span>
        </div>
        <p className="mt-2 text-[13px] text-[var(--ink-3)]">{a.case_ref}</p>
        <p className="mt-2 whitespace-pre-wrap text-[14px] text-[var(--ink-2)]">{a.statement}</p>
      </div>
    </div>
  );
}
