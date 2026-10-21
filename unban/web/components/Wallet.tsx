"use client";

/**
 * The visitor's wallet, shared by every page: eth_accounts on mount (never a
 * prompt), eth_requestAccounts only on Connect, listeners for account and
 * chain changes, the network switch, the GEN balance and Studio's faucet.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { CHAIN_HEX } from "@/lib/config";
import { gen, short } from "@/lib/format";
import { humanError } from "@/lib/human";
import { balanceOf, connect, faucet, switchNetwork } from "@/lib/write";

/* eslint-disable @typescript-eslint/no-explicit-any */

type WalletState = {
  address: string | null;
  chainOk: boolean;
  hasWallet: boolean;
  balance: bigint | null;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  refresh: () => Promise<void>;
  fund: () => Promise<string>;
};

const Ctx = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(true);
  const [balance, setBalance] = useState<bigint | null>(null);

  useEffect(() => {
    const eth = (globalThis as any).ethereum;
    if (!eth?.request) {
      setHasWallet(false);
      return;
    }
    let live = true;
    const onAccounts = (accounts: string[]) => live && setAddress(accounts?.[0] ?? null);
    const onChain = (id: string) => live && setChainId(String(id).toLowerCase());
    eth.request({ method: "eth_accounts" }).then(onAccounts).catch(() => {});
    eth.request({ method: "eth_chainId" }).then(onChain).catch(() => {});
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      live = false;
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (address) setBalance(await balanceOf(address));
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh, chainId]);

  const value: WalletState = {
    address,
    chainOk: chainId === CHAIN_HEX,
    hasWallet,
    balance,
    connect: async () => {
      const who = await connect();
      setAddress(who);
      try {
        await switchNetwork();
      } catch {
        /* the bar offers the switch again */
      }
      const eth = (globalThis as any).ethereum;
      setChainId(String(await eth.request({ method: "eth_chainId" })).toLowerCase());
    },
    switchNetwork: async () => {
      await switchNetwork();
      const eth = (globalThis as any).ethereum;
      setChainId(String(await eth.request({ method: "eth_chainId" })).toLowerCase());
    },
    refresh,
    fund: async () => {
      if (!address) return "Connect a wallet first.";
      const { before, after } = await faucet(address);
      setBalance(after);
      return after > before ? `Added ${gen(after - before)} test GEN.` : "The faucet did not add GEN this time. Try again in a minute.";
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The header control: Connect, wrong-network switch, or the short address with its balance. */
export function WalletButton() {
  const w = useWallet();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNote(null);
    try {
      const out = await fn();
      if (typeof out === "string") setNote(out);
    } catch (error) {
      setNote(humanError(error).text);
    } finally {
      setBusy(false);
    }
  };

  let control: ReactNode;
  if (!w.hasWallet) {
    control = (
      <a className="btn small" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
        Install a wallet
      </a>
    );
  } else if (!w.address) {
    control = (
      <button className="btn small" disabled={busy} onClick={() => act(w.connect)}>
        Connect wallet
      </button>
    );
  } else if (!w.chainOk) {
    control = (
      <button className="btn small" style={{ borderColor: "var(--bad)" }} disabled={busy} onClick={() => act(w.switchNetwork)}>
        Switch to Studio Next
      </button>
    );
  } else {
    control = (
      <span className="flex items-center gap-2">
        {w.balance === 0n && (
          <button className="btn small" disabled={busy} onClick={() => act(w.fund)} title="Studio's faucet: 100 test GEN">
            {busy ? <span className="spin" /> : "Get test GEN"}
          </button>
        )}
        <span className="btn small mono" title={w.address}>
          {short(w.address)}
          {w.balance !== null && <span className="text-[var(--ink-3)]">{gen(w.balance)} GEN</span>}
        </span>
      </span>
    );
  }

  return (
    <span className="relative">
      {control}
      {note && (
        <span className="absolute right-0 top-11 z-50 w-72 panel p-3 text-[13px] text-[var(--ink-2)]" role="status" onClick={() => setNote(null)}>
          {note}
        </span>
      )}
    </span>
  );
}
