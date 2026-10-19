'use client';
/**
 * One write, from the visitor's wallet, with every state a reviewer can hit:
 * no wallet, wrong network, no GEN (with the faucet), the fee shown before
 * signing, the hash the moment it exists, "Validators are comparing" while a
 * check runs, the contract's own sentence when it refuses, and a retry.
 */
import { useState } from 'react';
import { feesFor, feeCeiling, fund, gen, send, txUrl, balanceOf, GEN, Refused, type Call, isTransient } from '@/lib/chain';
import { useWallet } from './wallet';

/* eslint-disable @typescript-eslint/no-explicit-any */

type State =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string; hash?: string }
  | { kind: 'done'; hash: string }
  | { kind: 'failed'; message: string; hash?: string };

export function useTx() {
  const w = useWallet();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [fee, setFee] = useState<bigint | null>(null);

  async function run(call: Call, opts: { waiting?: string; onDone?: (receipt: any, hash: string) => void } = {}) {
    try {
      setState({ kind: 'busy', label: 'Connecting your wallet' });
      const address = w.address || (await w.connect());
      if (!w.chainOk) await w.switchNetwork().catch(() => {});
      const client = w.client();
      setState({ kind: 'busy', label: 'Estimating the fee' });
      const fees = await feesFor(client, call, address);
      const ceiling = feeCeiling(fees);
      setFee(ceiling);
      const need = (call.value ?? 0n) + ceiling;
      const have = await balanceOf(address);
      if (have < need) {
        setState({ kind: 'busy', label: `You hold ${gen(have)} GEN and this needs ${gen(need)}. Asking the Studio faucet` });
        const { after } = await fund(address, need - have + 10n * GEN);
        if (after < need) throw new Error('The faucet did not credit this address. Try again in a minute.');
      }
      setState({ kind: 'busy', label: 'Confirm in your wallet' });
      const { hash, receipt } = await send(client, call, {
        fees,
        payee: address,
        onHash: (h) => setState({ kind: 'busy', label: opts.waiting ?? 'Waiting for the validators', hash: h }),
      });
      setState({ kind: 'done', hash });
      opts.onDone?.(receipt, hash);
    } catch (e: any) {
      const message = e instanceof Refused
        ? `Refused: ${e.message}`
        : /User rejected|denied/i.test(String(e?.message))
          ? 'You declined in the wallet. Nothing was sent.'
          : isTransient(e)
            ? `Studio did not answer (${String(e?.shortMessage ?? e?.message ?? e).split('\n')[0].slice(0, 140)}). Wait a minute and try again.`
            : String(e?.shortMessage ?? e?.message ?? e).split('\n')[0].slice(0, 220);
      setState({ kind: 'failed', message, hash: e instanceof Refused ? e.hash : undefined });
    }
  }

  return { state, fee, run, reset: () => setState({ kind: 'idle' }) };
}

export function TxStatus({ state, fee, onRetry }: { state: State; fee: bigint | null; onRetry?: () => void }) {
  if (state.kind === 'idle') return null;
  if (state.kind === 'busy')
    return (
      <div className="notice" role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="spin" aria-hidden /> {state.label}
        {fee !== null && !state.hash ? <span className="faint">· fee deposit up to {gen(fee, 4)} GEN, unspent fees come back</span> : null}
        {state.hash ? (
          <a className="link hash" href={txUrl(state.hash)} target="_blank" rel="noreferrer">{state.hash.slice(0, 18)}…</a>
        ) : null}
      </div>
    );
  if (state.kind === 'done')
    return (
      <div className="notice" role="status">
        Accepted. <a className="link hash" href={txUrl(state.hash)} target="_blank" rel="noreferrer">{state.hash.slice(0, 18)}…</a>
      </div>
    );
  return (
    <div className="notice notice-bad" role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>{state.message}</span>
      {state.hash ? <a className="link hash" href={txUrl(state.hash)} target="_blank" rel="noreferrer">transaction</a> : null}
      {onRetry ? <button className="btn btn-sm" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}
