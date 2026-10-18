"use client";

/**
 * The wallet layer, on raw window.ethereum: eth_accounts on mount (never a
 * prompt), eth_requestAccounts only on a Connect click, listeners removed on
 * unmount, and a switch to Studio Next that adds the chain when the wallet
 * does not know it.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { gen, short } from "@/lib/format";
import { CHAIN_HEX } from "@/lib/network";
import { balanceOf, switchNetwork } from "@/lib/wallet";

/* eslint-disable @typescript-eslint/no-explicit-any */

type WalletState = {
  address: string | null;
  onNetwork: boolean;
  hasWallet: boolean;
  balance: bigint | null;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  refresh: () => Promise<void>;
  faucet: () => Promise<string>;
};

const Ctx = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useWallet outside WalletProvider");
  return value;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
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
    if (!address) return;
    try {
      setBalance(await balanceOf(address));
    } catch {
      setBalance(null);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    const eth = (globalThis as any).ethereum;
    if (!eth?.request) {
      setHasWallet(false);
      return;
    }
    const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
    setAddress(accounts?.[0] ?? null);
    await switchNetwork();
    setChainId(String(await eth.request({ method: "eth_chainId" })).toLowerCase());
  }, []);

  const switchChain = useCallback(async () => {
    await switchNetwork();
    const eth = (globalThis as any).ethereum;
    setChainId(String(await eth.request({ method: "eth_chainId" })).toLowerCase());
  }, []);

  const faucet = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first.");
    const response = await fetch("/api/faucet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message ?? "The faucet did not answer.");
    await refresh();
    return `Funded: ${gen(body.before)} → ${gen(body.after)} GEN`;
  }, [address, refresh]);

  return (
    <Ctx.Provider value={{ address, onNetwork: chainId === CHAIN_HEX, hasWallet, balance, connect, switchChain, refresh, faucet }}>
      {children}
    </Ctx.Provider>
  );
}

export function WalletButton() {
  const { address, onNetwork, hasWallet, connect, switchChain, balance } = useWallet();
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } catch {
      // the wallet showed its own message
    } finally {
      setBusy(false);
    }
  };
  if (!hasWallet) {
    return (
      <a className="btn sm" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
        Install a wallet
      </a>
    );
  }
  if (!address) {
    return (
      <button className="btn sm" onClick={run(connect)} disabled={busy}>
        {busy ? "Connecting" : "Connect wallet"}
      </button>
    );
  }
  if (!onNetwork) {
    return (
      <button className="btn sm" onClick={run(switchChain)} disabled={busy}>
        Switch to Studio Next
      </button>
    );
  }
  return (
    <span className="pill" title={address} style={{ color: "var(--ink)" }}>
      {short(address)}
      {balance !== null ? <span className="dim">· {gen(balance)} GEN</span> : null}
    </span>
  );
}

/**
 * The checks every write form needs before it can sign: a wallet, the right
 * network, and some GEN. Renders the fix for whichever is missing, or nothing.
 */
export function Ready({ need }: { need?: bigint }) {
  const { address, onNetwork, hasWallet, balance, connect, switchChain, faucet } = useWallet();
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  if (!hasWallet) {
    return <div className="note">This needs a browser wallet such as MetaMask. <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" style={{ color: "var(--amber)" }}>Install one</a>, reload, and connect.</div>;
  }
  if (!address) {
    return <div className="note">Connect a wallet to sign. <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => connect().catch(() => {})}>Connect wallet</button></div>;
  }
  if (!onNetwork) {
    return <div className="note">Your wallet is on another network. Unban runs on Studio Next, chain 61997. <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => switchChain().catch(() => {})}>Switch network</button></div>;
  }
  const low = balance !== null && balance < (need ?? 0n) + 10n ** 17n;
  if (!low && !msg) return null;
  return (
    <div className={`note ${msg.startsWith("Funded") ? "ok" : ""}`}>
      {low ? <>This wallet has {gen(balance ?? 0n)} GEN, not enough for this and its fee deposit. </> : null}
      {msg ? <span>{msg} </span> : null}
      {low ? (
        <button
          className="btn sm"
          style={{ marginLeft: 8 }}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setMsg(await faucet());
            } catch (error) {
              setMsg(String((error as Error).message));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Asking the faucet" : "Get test GEN"}
        </button>
      ) : null}
    </div>
  );
}
