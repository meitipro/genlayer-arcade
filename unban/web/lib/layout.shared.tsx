import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { Wordmark } from "@/components/Logo";
import { REPO } from "./config";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: <Wordmark />, url: "/" },
    githubUrl: REPO,
    links: [
      { text: "Courts", url: "/courts" },
      { text: "Rulings", url: "/rulings" },
      { text: "For moderators", url: "/mod" },
    ],
  };
}
