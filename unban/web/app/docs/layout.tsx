import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { Wordmark } from "@/components/Logo";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: <Wordmark />,
        url: "/",
        children: <span className="pill" style={{ marginLeft: 8 }}><span className="dot" />Studio Next</span>,
      }}
      links={[
        { text: "Courts", url: "/courts" },
        { text: "Rulings", url: "/rulings" },
        { text: "For moderators", url: "/mod" },
      ]}
      // The site is dark only, so the theme switch would do nothing.
      themeSwitch={{ enabled: false }}
      githubUrl="https://github.com/meitipro/genlayer-unban"
    >
      {children}
    </DocsLayout>
  );
}
