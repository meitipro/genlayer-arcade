"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toWei } from "@/lib/format";
import { send } from "@/lib/wallet";
import { TxStatus, type TxView } from "./TxStatus";
import { Ready, useWallet } from "./Wallet";

export function FundPool({ contract, courtId }: { contract: string; courtId: number }) {
  const { address, onNetwork, refresh } = useWallet();
  const router = useRouter();
  const [amount, setAmount] = useState("10");
  const [tx, setTx] = useState<TxView>({});
  const busy = Boolean(tx.phase && !tx.error && !tx.done);
  const go = async () => {
    try {
      const value = toWei(amount);
      setTx({});
      const { hash } = await send(address!, { address: contract, functionName: "fund", args: [courtId], value }, (phase, hash) => setTx({ phase, hash }));
      setTx({ done: `Added ${amount} GEN to the pool.`, hash });
      refresh();
      router.refresh();
    } catch (error) {
      const e = error as { message: string; hash?: string };
      setTx({ error: e.message, hash: e.hash });
    }
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Ready />
      <div style={{ display: "flex", gap: 8 }}>
        <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="GEN to add" style={{ maxWidth: 110 }} />
        <button className="btn sm" style={{ height: 40 }} onClick={go} disabled={!address || !onNetwork || busy}>Fund the pool</button>
      </div>
      <TxStatus tx={tx} onRetry={go} />
    </div>
  );
}
