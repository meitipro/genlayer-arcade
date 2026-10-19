"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { toWei } from "@/lib/format";
import type { Rule } from "@/lib/types";
import { reader, returnedOf, send } from "@/lib/wallet";
import { TxStatus, type TxView } from "./TxStatus";
import { Ready, useWallet } from "./Wallet";

type Template = { name: string; label: string; ladder: string[]; rules: Rule[] };

const TEMPLATES: Template[] = [
  {
    label: "Crypto Discord",
    name: "Kiln Discord",
    ladder: ["warning", "24h mute", "7-day mute", "ban"],
    rules: [
      { text: "No insults or harassment of other members.", first: 3, repeat: 4 },
      { text: "No scam, phishing or wallet-drainer links, any offence.", first: 4, repeat: 4 },
      { text: "No spam: the same message repeated or flooding a channel.", first: 2, repeat: 4 },
      { text: "Price talk only in #trading.", first: 2, repeat: 3 },
      { text: "No impersonating the team or moderators.", first: 4, repeat: 4 },
    ],
  },
  {
    label: "Telegram group",
    name: "Quill Telegram",
    ladder: ["warning", "24h mute", "ban"],
    rules: [
      { text: "Be civil: no insults, slurs or harassment.", first: 2, repeat: 3 },
      { text: "No links to token sales, presales or airdrops.", first: 3, repeat: 3 },
      { text: "English in the main group.", first: 1, repeat: 2 },
    ],
  },
  { label: "Blank", name: "", ladder: ["warning", "mute", "ban"], rules: [{ text: "", first: 1, repeat: 2 }] },
];

export function OpenCourtForm({ contract }: { contract: string }) {
  const { address, onNetwork } = useWallet();
  const [name, setName] = useState(TEMPLATES[0].name);
  const [ladder, setLadder] = useState<string[]>(TEMPLATES[0].ladder);
  const [rules, setRules] = useState<Rule[]>(TEMPLATES[0].rules);
  const [mods, setMods] = useState("");
  const [fee, setFee] = useState("2");
  const [comp, setComp] = useState("5");
  const [hoursText, setHours] = useState("48");
  const [pool, setPool] = useState("100");
  const [tx, setTx] = useState<TxView>({});
  const [opened, setOpened] = useState<number | null>(null);

  useEffect(() => {
    if (address && !mods) setMods(address);
  }, [address, mods]);

  const apply = (t: Template) => {
    setName(t.name);
    setLadder(t.ladder);
    setRules(t.rules);
  };
  const modList = mods.split(/[\s,]+/).map((m) => m.trim()).filter(Boolean);
  const totalChars = rules.reduce((n, r) => n + r.text.trim().length, 0);
  const hoursN = Number(hoursText);
  const problems = [
    !name.trim() || name.trim().length > 60 ? "Name the court in 1 to 60 characters." : "",
    ladder.length < 1 || ladder.some((l) => !l.trim() || l.trim().length > 24) ? "Every ladder level needs a label of up to 24 characters." : "",
    rules.length < 1 || rules.some((r) => !r.text.trim()) ? "Every rule needs its text." : "",
    totalChars > 2500 ? `The rules are ${totalChars} characters; the limit is 2500.` : "",
    rules.some((r) => r.repeat < r.first) ? "A repeat offence cannot be lighter than a first offence." : "",
    modList.length < 1 || modList.length > 10 || modList.some((m) => !/^0x[0-9a-fA-F]{40}$/.test(m)) ? "List 1 to 10 moderator addresses." : "",
    !Number.isInteger(hoursN) || hoursN < 12 || hoursN > 96 ? "The response window is 12 to 96 hours." : "",
  ].filter(Boolean);
  const busy = Boolean(tx.phase && !tx.error && !tx.done);

  const go = async () => {
    try {
      const feeWei = toWei(fee);
      const compWei = toWei(comp);
      const poolWei = toWei(pool || "0");
      if (feeWei <= 0n) throw new Error("The appeal fee must be above zero.");
      setTx({});
      const args = [
        name.trim(),
        JSON.stringify(rules.map((r) => ({ text: r.text.trim(), first: r.first, repeat: r.repeat }))),
        JSON.stringify(ladder.map((l) => l.trim())),
        JSON.stringify(modList),
        feeWei,
        compWei,
        hoursN,
      ];
      const { hash, receipt } = await send(address!, { address: contract, functionName: "open_court", args, value: poolWei }, (phase, hash) => setTx({ phase, hash }));
      let id = Number(returnedOf(receipt));
      if (!Number.isInteger(id) || id < 1) {
        id = JSON.parse(String(await reader().readContract({ address: contract, functionName: "list_appeals", args: [0, "", 0, 1] }))).courts;
      }
      setOpened(id);
      setTx({ done: `Court #${id} is open.`, hash });
    } catch (error) {
      const e = error as { message: string; hash?: string };
      setTx({ error: e.message, hash: e.hash });
    }
  };

  if (opened) {
    return (
      <div className="card pad" style={{ display: "grid", gap: 14 }}>
        <TxStatus tx={tx} />
        <span className="eyebrow amber">Next: install the bot</span>
        <p className="muted" style={{ margin: 0 }}>The bot reads rulings for court #{opened} and applies them in your Discord server with your own bot token. It never holds a wallet key.</p>
        <pre className="quote">{`cd bot\nUNBAN_COURT=${opened} DISCORD_TOKEN=... DISCORD_GUILD=... npm start`}</pre>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn solid" href={`/c/${opened}`}>Open the court page</Link>
          <Link className="btn" href="/docs/reference/bot-configuration">Bot configuration</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid cols-2" style={{ gap: 28 }}>
      <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
        <div className="field">
          <label>Start from a template</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TEMPLATES.map((t) => <button key={t.label} className="chip" onClick={() => apply(t)}>{t.label}</button>)}
          </div>
        </div>
        <div className="field">
          <label htmlFor="name">Court name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Kiln Discord" />
        </div>

        <div className="field">
          <label>Penalty ladder, lightest first (P1 to P{ladder.length})</label>
          {ladder.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="mono" style={{ width: 28, color: "var(--amber)" }}>P{i + 1}</span>
              <input className="input" value={l} maxLength={24} onChange={(e) => setLadder(ladder.map((x, j) => (j === i ? e.target.value : x)))} />
              {ladder.length > 1 ? (
                <button className="btn sm" aria-label={`Remove P${i + 1}`} onClick={() => {
                  setLadder(ladder.filter((_, j) => j !== i));
                  const max = ladder.length - 1;
                  setRules(rules.map((r) => ({ ...r, first: Math.min(r.first, max), repeat: Math.min(r.repeat, max) })));
                }}>×</button>
              ) : null}
            </div>
          ))}
          {ladder.length < 6 ? <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setLadder([...ladder, ""])}>Add a level</button> : null}
        </div>

        <div className="field">
          <label>Rules ({rules.length} of 12, {totalChars} of 2500 characters)</label>
          {rules.map((r, i) => (
            <div key={i} className="card" style={{ padding: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="mono" style={{ width: 22, color: "var(--amber)" }}>{i + 1}</span>
                <input className="input" value={r.text} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="No insults or harassment of other members." />
                {rules.length > 1 ? <button className="btn sm" aria-label={`Remove rule ${i + 1}`} onClick={() => setRules(rules.filter((_, j) => j !== i))}>×</button> : null}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingLeft: 30, fontSize: 13 }} className="muted">
                First offence
                <select className="select" style={{ width: "auto", padding: "4px 8px" }} value={r.first} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, first: Number(e.target.value) } : x)))}>
                  {ladder.map((l, k) => <option key={k} value={k + 1}>P{k + 1} {l}</option>)}
                </select>
                Repeat
                <select className="select" style={{ width: "auto", padding: "4px 8px" }} value={r.repeat} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, repeat: Number(e.target.value) } : x)))}>
                  {ladder.map((l, k) => <option key={k} value={k + 1}>P{k + 1} {l}</option>)}
                </select>
              </div>
            </div>
          ))}
          {rules.length < 12 ? <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setRules([...rules, { text: "", first: 1, repeat: Math.min(2, ladder.length) }])}>Add a rule</button> : null}
          <span className="hint">Write rules so that evidence never needs personal data: appeals and quotes are public.</span>
        </div>
      </div>

      <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <div className="card pad" style={{ display: "grid", gap: 14 }}>
          <div className="field">
            <label htmlFor="mods">Moderator addresses</label>
            <textarea id="mods" className="textarea" style={{ minHeight: 70 }} value={mods} onChange={(e) => setMods(e.target.value)} placeholder="0x…, one per line" />
            <span className="hint">Only these addresses can answer appeals. Your own address is filled in.</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field"><label htmlFor="fee">Appeal fee, GEN</label><input id="fee" className="input" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
            <div className="field"><label htmlFor="comp">Compensation, GEN</label><input id="comp" className="input" value={comp} onChange={(e) => setComp(e.target.value)} /></div>
            <div className="field"><label htmlFor="hours">Response window, h</label><input id="hours" className="input" value={hoursText} onChange={(e) => setHours(e.target.value)} /></div>
            <div className="field"><label htmlFor="pool">Fund the pool, GEN</label><input id="pool" className="input" value={pool} onChange={(e) => setPool(e.target.value)} /></div>
          </div>
          <span className="hint">Each appeal reserves one compensation from the pool when it is filed. Withdraw reclaims an idle pool later.</span>
          <Ready need={(() => { try { return toWei(pool || "0"); } catch { return 0n; } })()} />
          <button className="btn solid" onClick={go} disabled={!address || !onNetwork || problems.length > 0 || busy}>Open the court</button>
          {problems.length ? <span className="hint">{problems[0]}</span> : null}
          <TxStatus tx={tx} onRetry={go} />
        </div>
      </aside>
    </div>
  );
}
