import type { ReactNode } from "react";

import { Footer, Nav } from "@/components/Nav";
import { WalletProvider } from "@/components/Wallet";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </WalletProvider>
  );
}
