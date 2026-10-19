'use client';
import SearchDialog from '@/components/search';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { type ReactNode } from 'react';
import { WalletProvider } from '@/components/site/wallet';

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ SearchDialog }} theme={{ forcedTheme: 'dark', defaultTheme: 'dark', enableSystem: false }}>
      <WalletProvider>{children}</WalletProvider>
    </RootProvider>
  );
}
