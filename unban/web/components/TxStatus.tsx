"use client";

import { txUrl } from "@/lib/network";
import type { Phase } from "@/lib/wallet";

const TEXT: Record<Phase, string> = {
  estimating: "Asking Studio Next for the fee estimate",
  signing: "Confirm in your wallet",
  reviewing: "Validators are reviewing",
  finalizing: "Waiting for finality",
};

export type TxView = { phase?: Phase; hash?: string; error?: string; done?: string };

export function TxStatus({ tx, onRetry }: { tx: TxView; onRetry?: () => void }) {
  if (!tx.phase && !tx.error && !tx.done) return null;
  const link = tx.hash ? (
    <a href={txUrl(tx.hash)} target="_blank" rel="noreferrer" className="mono" style={{ color: "var(--amber)", fontSize: 12 }}>
      {tx.hash.slice(0, 12)}… on the explorer
    </a>
  ) : null;
  if (tx.error) {
    return (
      <div className="note err" role="alert" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span>{tx.error}</span>
        <span style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {link}
          {onRetry ? <button className="btn sm" onClick={onRetry}>Try again</button> : null}
        </span>
      </div>
    );
  }
  if (tx.done) {
    return (
      <div className="note ok" role="status" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span>{tx.done}</span>
        {link}
      </div>
    );
  }
  return (
    <div className="note" role="status" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span>
        {TEXT[tx.phase!]}
        {tx.phase === "reviewing" ? ". Several validators read the same record and must agree; this takes about a minute." : "…"}
      </span>
      {link}
    </div>
  );
}
