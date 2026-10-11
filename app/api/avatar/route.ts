// GET /api/avatar?u=<url>: a card portrait served from this site, so My Card
// can draw the card into a picture (a canvas refuses a cross-site image that
// was not sent with CORS headers). Only Discord and X avatar hosts, only images.
const HOSTS = /^https:\/\/(cdn\.discordapp\.com|pbs\.twimg\.com)\//;
const MAX = 2_000_000;

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u") ?? "";
  if (!HOSTS.test(u)) return new Response("not an avatar", { status: 400 });
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(5000) });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !/^image\/(png|jpeg|webp|gif)$/.test(type)) return new Response("no image", { status: 502 });
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX) return new Response("too large", { status: 502 });
    return new Response(buf, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new Response("no image", { status: 502 });
  }
}
