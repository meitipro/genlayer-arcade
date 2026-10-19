'use client';
/**
 * The visitor's wallet, through window.ethereum. Studio Next is the only
 * network the site signs on; a wallet on any other chain is asked to switch,
 * and to add 61997 if it has never seen it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CHAIN_HEX, EXPLORER, RPC, writerFor } from '@/lib/chain';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Wallet = {
  address: string;
  chainOk: boolean;
  hasWallet: boolean;
  connecting: boolean;
  error: string;
  connect: () => Promise<string>;
  switchNetwork: () => Promise<void>;
  client: () => any;
};

const Ctx = createContext<Wallet | null>(null);

function eth(): any {
  return typeof window !== 'undefined' ? (window as any).ethereum : undefined;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    const provider = eth();
    setHasWallet(!!provider);
    if (!provider) return;
    provider.request({ method: 'eth_accounts' }).then((a: string[]) => setAddress(a?.[0] ?? '')).catch(() => {});
    provider.request({ method: 'eth_chainId' }).then((c: string) => setChainId(String(c).toLowerCase())).catch(() => {});
    const onAccounts = (a: string[]) => setAddress(a?.[0] ?? '');
    const onChain = (c: string) => setChainId(String(c).toLowerCase());
    provider.on?.('accountsChanged', onAccounts);
    provider.on?.('chainChanged', onChain);
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const switchNetwork = useCallback(async () => {
    const provider = eth();
    if (!provider) throw new Error('No wallet found in this browser.');
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
    } catch (e: any) {
      if (e?.code === 4902 || /Unrecognized|not been added|unknown chain/i.test(String(e?.message))) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: CHAIN_HEX,
            chainName: 'GenLayer Studio Next',
            nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
            rpcUrls: [RPC],
            blockExplorerUrls: [EXPLORER],
          }],
        });
      } else {
        throw e;
      }
    }
    setChainId(String(await provider.request({ method: 'eth_chainId' })).toLowerCase());
  }, []);

  const connect = useCallback(async () => {
    const provider = eth();
    if (!provider) {
      setError('No wallet found. Install MetaMask or another browser wallet to write; reading needs none.');
      throw new Error('No wallet');
    }
    setConnecting(true);
    setError('');
    try {
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      const first = accounts?.[0] ?? '';
      setAddress(first);
      const current = String(await provider.request({ method: 'eth_chainId' })).toLowerCase();
      setChainId(current);
      if (current !== CHAIN_HEX) await switchNetwork();
      return first;
    } catch (e: any) {
      setError(String(e?.message ?? e).slice(0, 160));
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [switchNetwork]);

  const client = useCallback(() => writerFor({ address, provider: eth() }), [address]);

  const value = useMemo<Wallet>(
    () => ({ address, chainOk: chainId === CHAIN_HEX, hasWallet, connecting, error, connect, switchNetwork, client }),
    [address, chainId, hasWallet, connecting, error, connect, switchNetwork, client],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): Wallet {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWallet outside WalletProvider');
  return ctx;
}
