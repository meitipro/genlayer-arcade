import { pageText, pages } from "@/lib/llms";

export const dynamic = "force-static";

export function GET() {
  const body = pages()
    .map((p) => pageText(p.file, p.title, p.url, p.description))
    .join("\n---\n\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
