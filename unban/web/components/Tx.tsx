"use client";

/**
 * One write, start to finish: the fee estimate shown before signing, the
 * wallet prompt, the transaction link the moment it exists, the wait for
 * consensus ("Validators are reviewing" for judge), and either the done
 * state or the contract's own refusal with a retry.
 */

import { useState, type ReactNode } from "react";

import { IS_LIVE, txUrl } from "@/lib/config";
import { gen } from "@/lib/format";
import { humanError, type Advice } from "@/lib/human";
import { Refused, quote, send, type Call, type Quote } from "@/lib/write";

import { useWallet } from "./Wallet";

type Phase = "idle" | "quoting" | "quoted" | "signing" | "waiting" | "done" | "failed";

export function Tx({
  call,
  label,
  waitingText = "Waiting for consensus",
  disabled,
  onDone,
  validate,
  children,
}: {
  call: Call | (() => Call);
  label: string;
  waitingText?: string;
  disabled?: boolean;
  onDone?: (hash: string) => void;
  validate?: () => string | null;
  children?: ReactNode;
}) {
  const w = useWallet();
  const [phase, setPhase] = useState<Phase>("idle");
  const [q, setQ] = useState<Quote | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<Advice | null>(null);
  const [frozen, setFrozen] = useState<Call | null>(null);

  if (!IS_LIVE) return <p className="note grey">The contract address is not configured on this deployment yet, so nothing can be signed.</p>;

  const resolve = () => (typeof call === "function" ? call() : call);

  const review = async () => {
    setError(null);
    const problem = validate?.();
    if (problem) {
      setError({ text: problem });
      return;
    }
    try {
      if (!w.address) await w.connect();
    } catch (e) {
      setError(humanError(e));
      return;
    }
    let c: Call;
    try {
      c = resolve();
    } catch (e) {
      setError(humanError(e));
      return;
    }
    setFrozen(c);
    setPhase("quoting");
    try {
      setQ(await quote(w.address ?? "", c));
      setPhase("quoted");
    } catch (e) {
      setError(humanError(e));
      setPhase("failed");
    }
  };

  const sign = async () => {
    if (!frozen || !q || !w.address) return;
    setError(null);
    setPhase("signing");
    try {
      const done = await send(w.address, frozen, q, (h) => {
        setHash(h);
        setPhase("waiting");
      });
      setHash(done);
      setPhase("done");
      await w.refresh();
      onDone?.(done);
    } catch (e) {
      if (e instanceof Refused) setHash(e.hash);
      setError(humanError(e));
      setPhase("failed");
    }
  };

  const total = q ? (frozen?.value ?? 0n) + q.feeValue : 0n;

  return (
    <div className="flex flex-col gap-3">
      {children}
      {w.address && !w.chainOk && (
        <p className="note bad">
          Your wallet is on another network.{" "}
          <button className="link" onClick={() => w.switchNetwork().catch((e) => setError(humanError(e)))}>
            Switch to Studio Next (chain 61997)
          </button>
        </p>
      )}
      {w.address && w.chainOk && w.balance === 0n && (
        <p className="note">
          This wallet has no GEN.{" "}
          <button className="link" onClick={() => w.fund().then((t) => setError({ text: t }))}>
            Get 100 test GEN from the Studio faucet
          </button>
        </p>
      )}

      {(phase === "idle" || phase === "quoting" || (phase === "failed" && !q)) && (
        <button className="btn primary w-full sm:w-auto" disabled={disabled || phase === "quoting"} onClick={review}>
          {phase === "quoting" ? <span className="spin" /> : null}
          {w.address ? label : `Connect wallet to ${label.toLowerCase()}`}
        </button>
      )}

      {q && (phase === "quoted" || phase === "signing" || (phase === "failed" && !hash)) && (
        <div className="panel flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-2 text-[14px]">
            {frozen?.value ? (
              <>
                <span className="text-[var(--ink-3)]">Sent with the call</span>
                <span className="text-right font-mono">{gen(frozen.value)} GEN</span>
              </>
            ) : null}
            <span className="text-[var(--ink-3)]">Fee deposit (estimate)</span>
            <span className="text-right font-mono">{gen(q.feeValue)} GEN</span>
            <span className="text-[var(--ink-3)]">Total from your wallet</span>
            <span className="text-right font-mono text-[var(--amber)]">{gen(total)} GEN</span>
          </div>
          <p className="text-[12px] text-[var(--ink-3)]">The part of the fee deposit consensus does not spend is refunded at finality.</p>
          <div className="flex gap-2">
            <button className="btn primary" disabled={phase === "signing" || !w.chainOk} onClick={sign}>
              {phase === "signing" ? <span className="spin" /> : null} Sign in wallet
            </button>
            <button className="btn" onClick={() => { setQ(null); setPhase("idle"); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "waiting" && (
        <p className="note grey flex items-center gap-2">
          <span className="spin" /> {waitingText}…{" "}
          {hash && (
            <a className="link" href={txUrl(hash)} target="_blank" rel="noreferrer">
              transaction
            </a>
          )}
        </p>
      )}
      {phase === "done" && hash && (
        <p className="note">
          Done, accepted by consensus.{" "}
          <a className="link" href={txUrl(hash)} target="_blank" rel="noreferrer">
            View on the explorer
          </a>
        </p>
      )}
      {error && (
        <div className="note bad flex flex-col gap-2">
          <span>{error.text}</span>
          {hash && phase === "failed" && (
            <a className="link" href={txUrl(hash)} target="_blank" rel="noreferrer">
              The refused transaction on the explorer
            </a>
          )}
          {phase === "failed" && (
            <button className="btn small self-start" onClick={() => { setQ(null); setHash(null); setPhase("idle"); setError(null); }}>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
