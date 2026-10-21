"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Tx } from "@/components/Tx";
import { toWei } from "@/lib/format";

export function FundPool({ courtId }: { courtId: number }) {
  const [amount, setAmount] = useState("10");
  const router = useRouter();
  return (
    <div className="max-w-md">
      <Tx
        label="Fund the pool"
        validate={() => {
          try {
            return toWei(amount) > 0n ? null : "Enter an amount above zero.";
          } catch (e) {
            return (e as Error).message;
          }
        }}
        call={() => ({ functionName: "fund", args: [courtId], value: toWei(amount) })}
        onDone={() => router.refresh()}
      >
        <label className="label" htmlFor="fund">Amount, GEN</label>
        <input id="fund" className="field" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </Tx>
    </div>
  );
}
