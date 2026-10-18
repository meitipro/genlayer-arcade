import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

/** The contract source exactly as the repository holds it, for /deploy. */
export function GET() {
  const file = path.join(process.cwd(), "generated", "unban.py");
  return new Response(fs.readFileSync(file, "utf8"), { headers: { "Content-Type": "text/x-python; charset=utf-8" } });
}
