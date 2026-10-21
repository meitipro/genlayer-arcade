"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Verdict } from "@/components/Badge";
import { Tx } from "@/components/Tx";
import { useWallet } from "@/components/Wallet";
import { listAppeals } from "@/lib/chain";
import { gen } from "@/lib/format";
import type { Court } from "@/lib/types";

export function AppealForm({ court }: { court: Court }) {
  const w = useWallet();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [caseRef, setCaseRef] = useState("");
  const [bannedOn, setBannedOn] = useState(today);
  const [statement, setStatement] = useState("");

  const fee = BigInt(court.appeal_fee);
  const pool = BigInt(court.pool);
  const comp = BigInt(court.compensation);
  const reserve = pool < comp ? pool : comp;

  const check = () => {
    if (!caseRef.trim()) return "Name the case: your handle, the platform, where you were banned.";
    if (caseRef.trim().length > 120) return "The case is at most 120 characters.";
    if (!statement.trim()) return "Write your statement.";
    if (statement.trim().length > 1000) return "The statement is at most 1,000 characters.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bannedOn) || bannedOn > today) return "The ban date must be today or earlier.";
    return null;
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="label" htmlFor="case">Case · {caseRef.length}/120</label>
        <input id="case" className="field" maxLength={120} placeholder="ardal (Discord 418236001190019072), banned in #general" value={caseRef} onChange={(e) => setCaseRef(e.target.value)} />
        <p className="mt-1 text-[12px] text-[var(--ink-3)]">Your handle and the platform. Include your Discord user id so the bot can apply the ruling.</p>
      </div>
      <div>
        <label className="label" htmlFor="date">Date of the ban (UTC)</label>
        <input id="date" type="date" className="field" max={today} value={bannedOn} onChange={(e) => setBannedOn(e.target.value)} />
        <p className="mt-1 text-[12px] text-[var(--ink-3)]">It decides which version of the rules applies: a rule written after your ban never judges it.</p>
      </div>
      <div>
        <label className="label" htmlFor="statement">Your statement · {statement.length}/1000</label>
        <textarea id="statement" className="field" rows={6} maxLength={1000} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="What you posted, why you think no written rule was broken, or why the penalty is heavier than the ladder sets." />
      </div>

      <div className="panel p-4">
        <span className="eyebrow">Every outcome, before you sign</span>
        <table className="table mt-2">
          <tbody>
            <tr>
              <td><Verdict status="OVERTURNED" /></td>
              <td>You get {gen(fee + reserve)} GEN: the {gen(fee)} GEN fee back plus {gen(reserve)} GEN compensation</td>
            </tr>
            <tr>
              <td><Verdict status="REDUCED" level="P·" /></td>
              <td>The {gen(fee)} GEN fee back; the ban becomes the ladder&apos;s lighter level</td>
            </tr>
            <tr>
              <td><Verdict status="UPHELD" /></td>
              <td>The {gen(fee)} GEN fee goes to the court&apos;s pool; the ban stays</td>
            </tr>
            <tr>
              <td><Verdict status="DEFAULTED" /></td>
              <td>No answer in {court.response_hours} h: {gen(fee + reserve)} GEN to you, the ban is lifted</td>
            </tr>
          </tbody>
        </table>
        {reserve === 0n && <p className="note mt-3">This court&apos;s pool is empty, so no compensation can be reserved. The appeal still runs, with the fee as the only money at stake.</p>}
        {reserve > 0n && reserve < comp && <p className="note mt-3">The pool holds less than one full compensation, so {gen(reserve)} GEN is reserved for you.</p>}
      </div>

      <Tx
        label={`File the appeal, ${gen(fee)} GEN`}
        validate={check}
        call={() => ({ functionName: "appeal", args: [court.id, caseRef.trim(), bannedOn, statement.trim()], value: fee })}
        onDone={async () => {
          const rows = await listAppeals(court.id, "", 0, 10);
          const mine = rows.find((r) => r.member.toLowerCase() === (w.address ?? "").toLowerCase());
          router.push(mine ? `/a/${mine.id}` : `/c/${court.id}`);
        }}
      />
    </div>
  );
}
