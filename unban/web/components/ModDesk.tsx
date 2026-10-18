"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { gen, left, when } from "@/lib/format";
import type { Appeal, AppealRow, Court } from "@/lib/types";
import { reader, send } from "@/lib/wallet";
import { Ruling } from "./Ruling";
import { TxStatus, type TxView } from "./TxStatus";
import { Ready, useWallet } from "./Wallet";

export function ModDesk({ contract, courts, waiting, ruled }: { contract: string; courts: Court[]; waiting: AppealRow[]; ruled: AppealRow[] }) {
  const { address } = useWallet();
  const params = useSearchParams();
  const me = address?.toLowerCase() ?? "";
  const mine = useMemo(() => courts.filter((c) => c.mods.includes(me)), [courts, me]);
  const myIds = new Set(mine.map((c) => c.id));
  const queue = waiting.filter((a) => myIds.has(a.court_id)).sort((x, y) => x.filed_at - y.filed_at);
  const unanswered = queue.filter((a) => a.status === "FILED");
  const [selected, setSelected] = useState<number | null>(Number(params.get("appeal")) || null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!selected && unanswered[0]) setSelected(unanswered[0].id);
  }, [selected, unanswered]);

  if (!address) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <Ready />
        <p className="muted" style={{ margin: 0 }}>The desk shows the appeals waiting in every court that lists your address as a moderator.</p>
      </div>
    );
  }
  if (!mine.length) {
    return (
      <div className="card pad" style={{ display: "grid", gap: 8 }}>
        <span className="eyebrow">No courts for this address</span>
        <p className="muted" style={{ margin: 0 }}>No court lists {address} as a moderator. A court owner adds moderators when opening the court or with update_court.</p>
        <Link href="/new" style={{ color: "var(--amber)" }}>Open a court and list yourself</Link>
      </div>
    );
  }
  const current = queue.find((a) => a.id === selected) ?? null;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <span className="muted">{mine.map((c) => c.name).join(", ")} · {unanswered.length} appeal{unanswered.length === 1 ? "" : "s"} waiting for an answer</span>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 280px) minmax(0, 1fr)", gap: 20 }}>
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          {queue.length === 0 ? <div className="card pad dim" style={{ fontSize: 14 }}>Nothing is waiting. Every appeal in your courts has an answer.</div> : null}
          {queue.map((a) => (
            <button key={a.id} onClick={() => setSelected(a.id)} className={`card ${a.id === selected ? "hl" : ""}`}
              style={{ textAlign: "left", padding: "10px 12px", cursor: "pointer", color: "inherit", display: "grid", gap: 4 }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>#{a.id} {a.case_ref.split(" on ")[0]}</strong>
                <span className="mono" style={{ fontSize: 11.5, color: a.status === "FILED" ? "var(--amber)" : "var(--ink-3)" }}>
                  {a.status === "FILED" ? left(a.respond_by, now) : "answered"}
                </span>
              </span>
              <span className="dim" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>&ldquo;{a.statement}&rdquo;</span>
            </button>
          ))}
          <div className="card pad" style={{ fontSize: 12.5 }}>
            <span className="eyebrow">If nobody answers</span>
            <p className="muted" style={{ margin: "6px 0 0" }}>The appeal is granted by default: the ban is lifted and the reserved compensation goes to the member.</p>
          </div>
        </div>
        <div>{current ? <Answer key={current.id} contract={contract} row={current} now={now} /> : null}</div>
      </div>
      {ruled.filter((a) => myIds.has(a.court_id)).length ? (
        <div style={{ display: "grid", gap: 8 }}>
          <span className="eyebrow">Past rulings in your courts</span>
          {ruled.filter((a) => myIds.has(a.court_id)).slice(0, 8).map((a) => (
            <Link key={a.id} href={`/a/${a.id}`} className="card" style={{ padding: "10px 12px", display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "inherit" }}>
              <Ruling status={a.status} level={a.new_level} />
              <span>#{a.id} {a.case_ref}</span>
              <span className="dim mono" style={{ marginLeft: "auto", fontSize: 12 }}>{when(a.ruled_at).slice(0, 10)}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Answer({ contract, row, now }: { contract: string; row: AppealRow; now: number }) {
  const { address, onNetwork } = useWallet();
  const router = useRouter();
  const [a, setA] = useState<Appeal | null>(null);
  const [loadError, setLoadError] = useState("");
  const [rule, setRule] = useState(0);
  const [level, setLevel] = useState(0);
  const [evidence, setEvidence] = useState("");
  const [tx, setTx] = useState<TxView>({});
  useEffect(() => {
    reader()
      .readContract({ address: contract, functionName: "get_appeal", args: [row.id] })
      .then((raw: unknown) => setA(JSON.parse(String(raw))))
      .catch(() => setLoadError("Studio Next did not answer. Reload in a moment."));
  }, [contract, row.id]);
  if (loadError) return <div className="note err">{loadError}</div>;
  if (!a) return <div className="card pad dim">Reading appeal #{row.id}…</div>;
  if (a.status !== "FILED") {
    return (
      <div className="card pad" style={{ display: "grid", gap: 8 }}>
        <span className="eyebrow">Appeal #{a.id} is answered</span>
        <p className="muted" style={{ margin: 0 }}>Rule {a.rule}, P{a.level}. The member may reply until {when(a.reply_by)}; then anyone can ask the validators to rule.</p>
        <Link href={`/a/${a.id}`} style={{ color: "var(--amber)" }}>Open the appeal</Link>
      </div>
    );
  }
  const closed = now > a.respond_by;
  const chosen = rule ? a.rules[rule - 1] : null;
  const expected = chosen ? (a.earlier > 0 ? chosen.repeat : chosen.first) : 0;
  const busy = Boolean(tx.phase && !tx.error && !tx.done);
  const go = async () => {
    try {
      setTx({});
      const { hash } = await send(address!, { address: contract, functionName: "respond", args: [a.id, rule, level, evidence.trim()] }, (phase, hash) => setTx({ phase, hash }));
      setTx({ done: "Answer recorded, public next to your address.", hash });
      router.refresh();
    } catch (error) {
      const e = error as { message: string; hash?: string };
      setTx({ error: e.message, hash: e.hash });
    }
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="field">
        <label>Rule cited</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {a.rules.map((r, i) => (
            <button key={i} className={`chip ${rule === i + 1 ? "on" : ""}`} title={r.text} onClick={() => setRule(i + 1)}>
              {i + 1} {r.text.split(/[:,.]/)[0].slice(0, 22)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Penalty applied</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {a.ladder.map((l, i) => (
            <button key={i} className={`chip ${level === i + 1 ? "on" : ""}`} onClick={() => setLevel(i + 1)}>P{i + 1} {l}</button>
          ))}
        </div>
      </div>
      {chosen ? (
        <div className="note">
          Ladder for rule {rule}: first offence P{chosen.first}, repeat P{chosen.repeat}.{" "}
          {a.earlier === 0 ? "This member has no earlier ruling in this court." : `This member has ${a.earlier} earlier upheld or reduced ruling(s) here.`}
          {level && level > expected ? <strong> P{level} is heavier than the ladder sets, so expect a REDUCED ruling.</strong> : null}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="evidence">Evidence, quoted messages</label>
        <textarea id="evidence" className="textarea" rows={6} value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={1500}
          placeholder="[Oct 8 11:20] mirrr: gm (14 times in 2 minutes)" />
        <span className="hint">{evidence.length} / 1500. Quotes, not opinions: paste the exact messages with times and handles.</span>
      </div>
      <Ready />
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn solid" disabled={!address || !onNetwork || !rule || !level || !evidence.trim() || closed || busy} onClick={go}>Submit answer</button>
        <span className="dim mono" style={{ fontSize: 12 }}>{closed ? "The response window has closed." : "Public, next to your address"}</span>
      </div>
      <TxStatus tx={tx} onRetry={go} />
      <div className="card pad" style={{ display: "grid", gap: 6 }}>
        <span className="eyebrow">The appeal you are answering, #{a.id}</span>
        <span className="mono dim" style={{ fontSize: 12 }}>{a.case_ref} · fee {gen(a.fee)} GEN · reserved {gen(a.reserved)} GEN</span>
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{a.statement}</p>
      </div>
    </div>
  );
}
