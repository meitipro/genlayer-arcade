import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      sidebar={{
        banner: (
          <span className="flex items-center gap-2 rounded-[4px] border border-[var(--line-2)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink-2)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]" /> Studio Next · chain 61997
          </span>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
