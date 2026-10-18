"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { gen, left } from "@/lib/format";
import type { Appeal } from "@/lib/types";
import { send } from "@/lib/wallet";
import { TxStatus, type TxView } from "./TxStatus";
import { Ready, useWallet } from "./Wallet";

/** The one next step this appeal allows, for whoever is looking. */
export function AppealActions({ contract, a, mods }: { contract: string; a: Appeal; mods: string[] }) {
  const { address, onNetwork, refresh } = useWallet();
  const router = useRouter();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [reply, setReply] = useState("");
  const [tx, setTx] = useState<TxView>({});
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);
  const me = address?.toLowerCase() ?? "";
  const isMember = me === a.member.toLowerCase();
  const isMod = mods.includes(me);
  const busy = Boolean(tx.phase && !tx.error && !tx.done);
  const can = Boolean(address && onNetwork && !busy);

  const run = (functionName: string, args: unknown[], done: string, waitUntil: "decided" | "finalized" = "decided") => async () => {
    try {
      setTx({});
      const { hash } = await send(address!, { address: contract, functionName, args }, (phase, hash) => setTx({ phase, hash }), waitUntil);
      setTx({ done, hash });
      refresh();
      router.refresh();
    } catch (error) {
      const e = error as { message: string; hash?: string };
      setTx({ error: e.message, hash: e.hash });
    }
  };

  let body: React.ReactNode = null;
  if (a.status === "FILED") {
    if (now > a.respond_by) {
      body = (
        <>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>No moderator answered within the window. Anyone can now settle it as DEFAULTED: the member gets the fee and compensation back.</p>
          <Ready />
          <button className="btn solid" disabled={!can} onClick={run("default", [a.id], "Defaulted. The member's balance is ready to withdraw.")}>Settle as defaulted</button>
        </>
      );
    } else {
      body = (
        <>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Waiting for a moderator: {left(a.respond_by, now)}. If nobody answers in time, the appeal is granted by default.</p>
          {isMod ? <Link className="btn solid" href={`/mod?appeal=${a.id}`}>Answer at the moderator desk</Link> : null}
        </>
      );
    }
  } else if (a.status === "ANSWERED") {
    const replyOpen = !a.replied && now <= a.reply_by;
    body = (
      <>
        {isMember && replyOpen ? (
          <>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>You may reply once to the evidence, {left(a.reply_by, now)}. This is where you dispute a quote.</p>
            <textarea className="textarea" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={600} placeholder="Rule 1 is about insults. Asking which date is right is neither." />
            <span className="hint">{reply.length} / 600</span>
            <Ready />
            <button className="btn solid" disabled={!can || !reply.trim()} onClick={run("reply", [a.id, reply.trim()], "Reply recorded. Anyone can now ask the validators to rule.")}>Send my reply</button>
          </>
        ) : replyOpen ? (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>The member may reply once, {left(a.reply_by, now)}. Judging opens after the reply or when that window ends.</p>
        ) : null}
        {!replyOpen ? (
          <>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>The record is complete. Anyone can ask the validators to rule on it.</p>
            <Ready />
            <button className="btn solid" disabled={!can} onClick={run("judge", [a.id], "Ruled. The verdict is below.")}>Ask the validators to rule</button>
          </>
        ) : null}
      </>
    );
  } else if (BigInt(a.member_balance) > 0n) {
    body = isMember ? (
      <>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Your balance in Unban is {gen(a.member_balance)} GEN. Withdraw pays it to this wallet; it lands at finality.</p>
        <Ready />
        <button className="btn solid" disabled={!can} onClick={run("withdraw", [], `Withdrawn: ${gen(a.member_balance)} GEN sent to your wallet.`, "finalized")}>Withdraw {gen(a.member_balance)} GEN</button>
      </>
    ) : (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>The member has {gen(a.member_balance)} GEN waiting to withdraw.</p>
    );
  } else {
    body = <p className="muted" style={{ margin: 0, fontSize: 14 }}>Settled. Nothing is waiting to be withdrawn by the member.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {body}
      <TxStatus tx={tx} />
    </div>
  );
}
