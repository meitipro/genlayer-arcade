import Link from "next/link";
import deployment from "@/lib/deployment.json";
import { explorerBase } from "@/lib/explorer";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Community-built. Not an official GenLayer product. Daily games settle on {deployment.network === "studionet" ? "Studionet" : deployment.network}.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/seasons" className="hover:text-text">Seasons</Link>
          <Link href="/how" className="hover:text-text">How it works</Link>
          <a href={explorerBase} className="hover:text-text" target="_blank" rel="noreferrer">Explorer</a>
          <a href="https://genlayer.com" className="hover:text-text" target="_blank" rel="noreferrer">genlayer.com</a>
          <a href="https://github.com/meitipro/genlayer-arcade" className="hover:text-text" target="_blank" rel="noreferrer">Source</a>
        </nav>
      </div>
    </footer>
  );
}
