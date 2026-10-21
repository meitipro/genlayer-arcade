import fs from "node:fs";
import path from "node:path";

import { source } from "./source";

const ROOT = path.join(process.cwd(), "content", "docs");

/** One docs page as plain markdown: its title, its URL and its MDX body without frontmatter. */
export function pageText(file: string, title: string, url: string, description?: string): string {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8").replace(/^---[\s\S]*?---\s*/, "");
  return `# ${title}\n\nURL: https://use-unban.vercel.app${url}\n${description ? `\n${description}\n` : ""}\n${raw.trim()}\n`;
}

/** Every page in sidebar order, so llms-full.txt reads like the docs. */
export function pages() {
  const order: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      if (n.type === "page") order.push(n.url);
      if (n.children) walk(n.children);
    }
  };
  walk(source.getPageTree().children);
  return source
    .getPages()
    .sort((a, b) => order.indexOf(a.url) - order.indexOf(b.url))
    .map((p) => ({ file: p.path, title: p.data.title, description: p.data.description, url: p.url }));
}
