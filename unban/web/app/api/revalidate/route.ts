import { revalidateTag } from "next/cache";

import { TAG } from "@/lib/read";

/**
 * Drops the cached chain reads after a write is decided, so the writer sees
 * their own result. It takes no input and reveals nothing; the worst a caller
 * can do is make the next page view read the chain fresh.
 */
export async function POST() {
  revalidateTag(TAG);
  return Response.json({ ok: true });
}
