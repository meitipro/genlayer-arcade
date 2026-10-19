"use client";

import { useEffect, useRef, useState } from "react";

import { addressUrl, txUrl } from "@/lib/network";
import { deploy, goldenRun, readJson, seed, walk, type Golden } from "@/lib/runner";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Line = { at: string; text: string; hash?: string };
type Records = { deployment?: any; walk?: any; results?: any; seed?: any };

const STORE = "unban-run-records";

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Runs the whole evidence path from this tab. Records (never keys) are kept
 * in localStorage so a finished run can still be downloaded after a reload.
 */
export function Runner({ current, golden }: { current: string; golden: Golden & { seal: string } }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [records, setRecords] = useState<Records>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [steps, setSteps] = useState({ deploy: !current, walk: true, golden: true, seed: true });
  const [target, setTarget] = useState(current);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "{}");
      if (saved && typeof saved === "object") setRecords(saved);
    } catch {
      // nothing saved, or storage is blocked
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(records));
    } catch {
      // storage is blocked; the downloads still work
    }
  }, [records]);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [lines]);

  const say = (text: string, hash?: string) => setLines((l) => [...l, { at: new Date().toISOString().slice(11, 19), text, hash }]);

  const run = async () => {
    setBusy(true);
    setError("");
    setLines([]);
    try {
      let contract = target;
      if (steps.deploy) {
        say("deploying contracts/unban.py to Studio Next with a fresh test account");
        const deployment = await deploy(say, (phase, hash) => phase === "finalizing" && hash && say("waiting for the deploy to finalize", hash));
        contract = deployment.address;
        setTarget(contract);
        setRecords((r) => ({ ...r, deployment }));
      }
      if (!/^0x[0-9a-fA-F]{40}$/.test(contract)) throw new Error("There is no contract to run against. Tick Deploy, or set NEXT_PUBLIC_UNBAN_CONTRACT.");
      await readJson(contract, "list_appeals", [0, "", 0, 1]);
      if (steps.walk) {
        say("walking the reviewer's path from fresh accounts");
        const w = await walk(say, contract, golden);
        setRecords((r) => ({ ...r, walk: w }));
      }
      if (steps.golden) {
        say("running the 9 golden cases and 3 held-out cases through consensus");
        const g = await goldenRun(say, contract, golden, (partial) => setRecords((r) => ({ ...r, results: { ...partial } })));
        setRecords((r) => ({ ...r, results: g }));
      }
      if (steps.seed) {
        say("seeding Kiln Discord and Quill Telegram with appeals for the moderator desk");
        const s = await seed(say, contract, golden);
        setRecords((r) => ({ ...r, seed: s }));
      }
      say("done");
    } catch (e) {
      const err = e as { message?: string; hash?: string };
      const raw = String(err?.message ?? e);
      // viem wraps the relay's answer; show the sentence that says what happened.
      const text = /Studio Next did not answer/.test(raw) ? "Studio Next did not answer. Wait a minute and press Run again; nothing was lost." : raw.split("\n")[0];
      setError(text);
      say(`stopped: ${text}`, err?.hash);
    } finally {
      setBusy(false);
    }
  };

  const contract = records.deployment?.address ?? target;
  const scored = (records.results?.cases ?? []).filter((c: any) => c.pass === true || c.pass === false);
  const portal = [
    contract ? `Contract: ${addressUrl(contract)}` : "",
    records.deployment ? `Deploy transaction: ${txUrl(records.deployment.deploy_tx)}` : "",
    ...(records.walk?.steps ?? []).map((s: any) => `Walk, ${s.step}: ${s.explorer}`),
    ...(records.results?.cases ?? []).filter((c: any) => c.judge_attempts?.length).map((c: any) => `Golden case ${c.id} (${c.verdict} ${c.level ?? ""}): ${txUrl(c.judge_attempts[c.judge_attempts.length - 1].hash)}`),
  ].filter(Boolean).join("\n");

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="card pad" style={{ display: "grid", gap: 12 }}>
        <span className="eyebrow">What to run</span>
        <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={steps.deploy} onChange={(e) => setSteps({ ...steps, deploy: e.target.checked })} /> Deploy a new Unban contract{current ? " (this site already reads one)" : ""}</label>
        {!steps.deploy ? (
          <div className="field">
            <label htmlFor="target">Contract to run against</label>
            <input id="target" className="input mono" value={target} onChange={(e) => setTarget(e.target.value.trim())} placeholder="0x…" />
          </div>
        ) : null}
        <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={steps.walk} onChange={(e) => setSteps({ ...steps, walk: e.target.checked })} /> Walk the reviewer&apos;s path to finality, with two refusals on chain</label>
        <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={steps.golden} onChange={(e) => setSteps({ ...steps, golden: e.target.checked })} /> Golden cases through real consensus (9 scored, 3 held out)</label>
        <label style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={steps.seed} onChange={(e) => setSteps({ ...steps, seed: e.target.checked })} /> Seed two courts with appeals waiting at the moderator desk</label>
        <span className="hint">Golden set sealed: <span className="mono">{golden.seal.slice(0, 24)}…</span>. Everything together takes about 30 to 45 minutes; keep this tab open. Each step uses fresh test accounts that live only in this tab.</span>
        <button className="btn solid" style={{ justifySelf: "start" }} onClick={run} disabled={busy}>{busy ? "Running…" : "Run"}</button>
        {error ? <div className="note err">{error}</div> : null}
      </div>

      <div ref={box} className="quote" style={{ maxHeight: 360, overflowY: "auto", minHeight: 80 }}>
        {lines.length === 0 ? <span className="dim">The log appears here.</span> : lines.map((l, i) => (
          <div key={i}>
            <span className="dim">{l.at} </span>{l.text}
            {l.hash ? <> · <a href={txUrl(l.hash)} target="_blank" rel="noreferrer" style={{ color: "var(--amber)" }}>{l.hash.slice(0, 10)}…</a></> : null}
          </div>
        ))}
      </div>

      {Object.keys(records).length ? (
        <div className="card pad" style={{ display: "grid", gap: 14 }}>
          <span className="eyebrow amber">Results</span>
          {contract ? <span>Contract <a className="mono" style={{ color: "var(--amber)" }} href={addressUrl(contract)} target="_blank" rel="noreferrer">{contract}</a></span> : null}
          {scored.length ? <span>Golden cases: <strong>{scored.filter((c: any) => c.pass).length} of {scored.length}</strong> as expected, plus {(records.results?.cases ?? []).length - scored.length} held out.</span> : null}
          {records.walk?.steps?.find((s: any) => s.step === "withdraw") ? <span>Withdraw exact to the wei: <strong>{String(records.walk.steps.find((s: any) => s.step === "withdraw").exact)}</strong></span> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {records.deployment ? <button className="btn sm" onClick={() => download("deployment.json", records.deployment)}>deployment.json</button> : null}
            {records.results ? <button className="btn sm" onClick={() => download("results.json", records.results)}>results.json</button> : null}
            {records.walk ? <button className="btn sm" onClick={() => download("walk.json", records.walk)}>walk.json</button> : null}
            {records.seed ? <button className="btn sm" onClick={() => download("seed.json", records.seed)}>seed.json</button> : null}
            <button className="btn sm" onClick={() => { setRecords({}); setLines([]); }}>Clear</button>
          </div>
          {records.deployment ? (
            <div className="note">
              Point the site at it: in Vercel, Settings, Environment Variables, add <code>NEXT_PUBLIC_UNBAN_CONTRACT</code> = <code>{records.deployment.address}</code> for Production, then Redeploy.
            </div>
          ) : null}
          {portal ? (
            <div className="field">
              <label>Links for the portal form</label>
              <textarea className="textarea" readOnly value={portal} rows={10} onFocus={(e) => e.currentTarget.select()} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
