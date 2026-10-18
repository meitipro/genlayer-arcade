import { SiteFooter, SiteNav } from "@/components/SiteNav";
import { WalletProvider } from "@/components/Wallet";
import { CONTRACT } from "@/lib/deployment";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <SiteNav />
      <main>{children}</main>
      <SiteFooter contract={CONTRACT} />
    </WalletProvider>
  );
}
