import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://genlayergamehub.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "GenLayer Arcade", template: "%s · GenLayer Arcade" },
  description: "Play, compete, get judged by consensus. Nine games built around how GenLayer works, three of them settled on-chain by Intelligent Contracts.",
  openGraph: {
    title: "GenLayer Arcade",
    description: "Play, compete, get judged by consensus.",
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/api/og/home"] },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#08080C", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts by link: next/font cannot reach gstatic from the build machine */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout, loads on every page */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Space+Grotesk:wght@500;700&display=swap"
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[10px] focus:bg-accent focus:px-3 focus:py-2 focus:text-bg">
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
