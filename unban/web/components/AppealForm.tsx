"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { gen } from "@/lib/format";
import type { Court } from "@/lib/types";
import { reader, returnedOf, send } from "@/lib/wallet";
import { Ruling } from "./Ruling";
import { TxStatus, type TxView } from "./TxStatus";
import { Ready, useWallet } from "./Wallet";

const PLATFORMS = ["Discord", "Telegram", "X"];

export function AppealForm({ contract, court }: { contract: string; court: Court }) {
  const { address, onNetwork } = useWallet();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("Discord");
  const [date, setDate] = useState(today);
  const [statement, setStatement] = useState("");
  const [tx, setTx] = useState<TxView>({});
  const caseRef = `${handle.trim()} on ${platform}, banned ${date}`;
  const fee = BigInt(court.appeal_fee);
  const comp = BigInt(court.compensation);
  const reserved = comp > 0n && BigInt(court.pool) >= comp ? comp : 0n;
  const problems = [
    handle.trim().length < 2 ? "Write your handle." : "",
    caseRef.length > 120 ? "The case line is over 120 characters; shorten the handle." : "",
    date > today ? "The ban date cannot be in the future." : "",
    statement.trim().length === 0 ? "Write your statement." : "",
    statement.length > 1000 ? "The statement is over 1000 characters." : "",
  ].filter(Boolean);
  const busy = Boolean(tx.phase && !tx.error && !tx.done);

  const go = async () => {
    try {
      setTx({});
      const { hash, receipt } = await send(
        address!,
        { address: contract, functionName: "appeal", args: [court.id, caseRef, statement.trim()], value: fee },
        (phase, hash) => setTx({ phase, hash }),
      );
      let id = Number(returnedOf(receipt));
      if (!Number.isInteger(id) || id < 1) {
        const page = JSON.parse(String(await reader().readContract({ address: contract, functionName: "list_appeals", args: [court.id, "", 0, 1] })));
        id = page.items?.[0]?.id;
      }
      setTx({ done: `Appeal #${id} filed. Opening it…`, hash });
      router.push(`/a/${id}`);
    } catch (error) {
      const e = error as { message: string; hash?: string };
      setTx({ error: e.message, hash: e.hash });
    }
  };

  return (
    <div className="grid cols-2" style={{ gap: 28 }}>
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 140px", gap: 12 }}>
          <div className="field">
            <label htmlFor="handle">Your handle</label>
            <input id="handle" className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="ardal" maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="platform">Platform</label>
            <select id="platform" className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="date">Date of the ban</label>
          <input id="date" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} />
          <span className="hint">The rules in force before that day are the ones your appeal is judged by.</span>
        </div>
        <div className="field">
          <label htmlFor="statement">Your statement</label>
          <textarea id="statement" className="textarea" value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={1000} rows={7}
            placeholder="What happened, in your own words. The moderator answers with the rule and the quoted messages." />
          <span className="hint">{statement.length} / 1000. Appeals are public: never include personal data.</span>
        </div>
        <div className="card pad mono" style={{ fontSize: 12.5 }}>
          <span className="dim">The case line stored on chain:</span>
          <div style={{ marginTop: 4 }}>{caseRef}</div>
        </div>
        <Ready need={fee} />
        <button className="btn solid" onClick={go} disabled={!address || !onNetwork || problems.length > 0 || busy}>
          File the appeal for {gen(fee)} GEN
        </button>
        {problems.length && (handle || statement) ? <span className="hint">{problems[0]}</span> : null}
        <TxStatus tx={tx} onRetry={go} />
      </div>
      <aside className="card pad" style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <span className="eyebrow">Every outcome, before you sign</span>
        <Outcome status="OVERTURNED" text={`You get ${gen(fee + reserved)} GEN back${reserved ? ` (fee plus ${gen(reserved)} compensation)` : ", the fee only: the pool cannot cover compensation right now"}. The bot lifts the ban.`} />
        <Outcome status="REDUCED" text={`You get the ${gen(fee)} GEN fee back. The bot replaces the ban with the ladder's penalty.`} />
        <Outcome status="UPHELD" text={`The ${gen(fee)} GEN fee goes to the court's pool. The ban stays.`} />
        <Outcome status="DEFAULTED" text={`If no moderator answers within ${court.response_hours} h, you get ${gen(fee + reserved)} GEN back and the ban is lifted.`} />
        <p className="dim" style={{ margin: 0, fontSize: 12.5 }}>One open appeal per case, and one appeal per address in this court every 7 days. Consensus fees are paid from your wallet on top of the appeal fee.</p>
      </aside>
    </div>
  );
}

function Outcome({ status, text }: { status: "OVERTURNED" | "REDUCED" | "UPHELD" | "DEFAULTED"; text: string }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Ruling status={status} level={status === "REDUCED" ? "P?" : undefined} />
      <span className="muted" style={{ fontSize: 13.5 }}>{text}</span>
    </div>
  );
}
