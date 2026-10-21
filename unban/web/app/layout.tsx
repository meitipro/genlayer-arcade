import "@fontsource-variable/outfit";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/600.css";
import "./globals.css";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://use-unban.vercel.app"),
  title: { default: "Unban · Ban appeals, decided by the community's own rules", template: "%s · Unban" },
  description:
    "A ban appeal court for online communities on GenLayer. Rules and a penalty ladder written in advance, a small appeal fee, a moderator's quoted evidence, and validators who rule by the written rules alone.",
  icons: { icon: "/logo.svg" },
  openGraph: { images: ["/logo-512.png"] },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ forcedTheme: "dark", defaultTheme: "dark", enableSystem: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
