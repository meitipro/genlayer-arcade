"use client";
// components/TxStatus.tsx: live chain status in mono with an elapsed timer (section 16).
import { useEffect, useState } from "react";

export type TxState = { status: string; result?: string; error?: string; agree?: number; voters?: number; note?: string };

const DONE = ["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"];

export function isDecided(s?: TxState) {
  return !!s && DONE.includes(s.status) && (!["ACCEPTED", "FINALIZED"].includes(s.status) || !!s.result);
}
export function isSuccess(s?: TxState) {
  return !!s && ["ACCEPTED", "FINALIZED"].includes(s.status) && s.result === "FINISHED_WITH_RETURN";
}

export function useTx(game: string, hash?: string | null) {
  const [s, setS] = useState<TxState>();
  useEffect(() => {
    if (!hash) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const base = game === "community" ? "/api/community/status" : `/api/daily/${game}/status`;
        const r = await fetch(`${base}?hash=${hash}`, { cache: "no-store" }).then((x) => x.json());
        if (stop) return;
        if (r.status) setS(r);
        // keep polling until the outcome is decided; after ACCEPTED, slowly, to catch FINALIZED
        if (!isDecided(r)) timer = setTimeout(tick, 4000);
        else if (r.status === "ACCEPTED") timer = setTimeout(tick, 30000);
      } catch {
        // a network blip after a hash exists is not a failure: keep polling
        if (!stop) timer = setTimeout(tick, 6000);
      }
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [game, hash]);
  return s;
}

export function TxStatus({ state, since, explorer }: { state?: TxState; since: number; explorer: string }) {
  const [now, setNow] = useState(Date.now());
  const decided = isDecided(state);
  useEffect(() => {
    if (decided) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [decided]);
  const elapsed = Math.max(0, Math.floor((now - since) / 1000));
  const status = state?.status ?? "PENDING";
  const ok = isSuccess(state);
  const color = ok || !decided ? "var(--accent)" : "var(--danger)";
  return (
    <div className="card space-y-2 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`mono text-lg font-semibold ${decided ? "" : "deliberating"}`} style={{ color }}>
          {status}
        </span>
        {!decided && <span className="mono text-sm text-muted">{elapsed}s</span>}
        {state?.agree !== undefined && state.voters ? (
          <span className="mono text-sm text-muted">
            {state.agree} of {state.voters} agree
          </span>
        ) : null}
        <a href={explorer} target="_blank" rel="noreferrer" className="mono ml-auto text-xs uppercase text-accent underline-offset-4 hover:underline">
          view on explorer
        </a>
      </div>
      {!decided && <p className="text-sm text-muted">The validators are deliberating. This usually takes under a minute.</p>}
      {state?.note && !decided && <p className="text-xs text-muted">{state.note}. Still polling.</p>}
    </div>
  );
}
