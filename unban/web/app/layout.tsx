import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Unban: ban appeals, ruled by the community's own rules", template: "%s · Unban" },
  description:
    "A ban appeal court for online communities on GenLayer. A community writes its rules and penalty ladder once, banned members appeal with a small fee, moderators answer with evidence, and validators rule by the written rules.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://use-unban.vercel.app"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Geist+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <RootProvider theme={{ forcedTheme: "dark", defaultTheme: "dark" }}>{children}</RootProvider>
      </body>
    </html>
  );
}
