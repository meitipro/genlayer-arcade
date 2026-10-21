import { pages } from "@/lib/llms";

export const dynamic = "force-static";

export function GET() {
  const lines = [
    "# Unban",
    "",
    "> Ban appeals for online communities, decided by the community's own written rules on GenLayer Studio Next (chain 61997).",
    "",
    "## Docs",
    "",
    ...pages().map((p) => `- [${p.title}](https://use-unban.vercel.app${p.url}): ${p.description ?? ""}`),
    "",
    "Full text of every page: https://use-unban.vercel.app/llms-full.txt",
  ];
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
