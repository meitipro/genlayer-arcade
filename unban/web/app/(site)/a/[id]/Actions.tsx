"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Tx } from "@/components/Tx";
import { useWallet } from "@/components/Wallet";
import { gen, when } from "@/lib/format";
import type { Appeal } from "@/lib/types";

/** What can be done on this appeal right now, and by whom. */
export function Actions({ a }: { a: Appeal }) {
  const w = useWallet();
  const router = useRouter();
  const [reply, setReply] = useState("");
  const isMember = !!w.address && w.address.toLowerCase() === a.member.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-4">
      {a.status === "ANSWERED" && !a.reply && now <= a.reply_by && isMember && (
        <div className="panel p-5">
          <span className="eyebrow">Your one reply · {reply.length}/600</span>
          <p className="mt-1 mb-3 text-[13px] text-[var(--ink-3)]">Until {when(a.reply_by)}. This is where a quote gets disputed, in public.</p>
          <Tx
            label="Send the reply"
            validate={() => (!reply.trim() ? "Write the reply first." : reply.trim().length > 600 ? "At most 600 characters." : null)}
            call={() => ({ functionName: "reply", args: [a.id, reply.trim()] })}
            onDone={refresh}
          >
            <textarea className="field" rows={4} maxLength={600} value={reply} onChange={(e) => setReply(e.target.value)} />
          </Tx>
        </div>
      )}

      {a.judge_ready && (
        <div className="panel p-5">
          <span className="eyebrow">Judging is open</span>
          <p className="mt-1 mb-3 text-[13px] text-[var(--ink-3)]">
            Anyone can call it. Validators read the rules, the record and the appeal, and must agree on the verdict and the level.
          </p>
          <Tx label="Ask the validators to rule" waitingText="Validators are reviewing" call={{ functionName: "judge", args: [a.id] }} onDone={refresh} />
        </div>
      )}

      {a.default_ready && (
        <div className="panel p-5">
          <span className="eyebrow">No moderator answered in time</span>
          <p className="mt-1 mb-3 text-[13px] text-[var(--ink-3)]">
            Anyone can grant the appeal by default: the member gets {gen(BigInt(a.fee) + BigInt(a.reserved))} GEN and the bot lifts the ban.
          </p>
          <Tx label="Grant by default" call={{ functionName: "default", args: [a.id] }} onDone={refresh} />
        </div>
      )}
    </div>
  );
}

export function Withdraw({ member, balance }: { member: string; balance: string }) {
  const w = useWallet();
  const router = useRouter();
  const isMember = !!w.address && w.address.toLowerCase() === member.toLowerCase();
  if (!isMember || BigInt(balance) === 0n) return null;
  return <Tx label={`Withdraw ${gen(balance)} GEN`} call={{ functionName: "withdraw", args: [0] }} onDone={() => router.refresh()} />;
}
