import Link from "next/link";

import type { Loaded } from "@/lib/chain";

/** What a page shows instead of data, for each reason a read can fail. */
export function Unavailable({ result }: { result: Exclude<Loaded<unknown>, { ok: true }> }) {
  if (result.reason === "not_deployed") {
    return (
      <div className="note grey">
        The Unban contract address is not configured on this deployment yet, so there is nothing on chain to show.
        The <Link className="link" href="/docs/reference/addresses">addresses page</Link> says where it lives once deployed.
      </div>
    );
  }
  if (result.reason === "missing") {
    return <div className="note grey">That does not exist on chain. Check the number in the address.</div>;
  }
  return (
    <div className="note bad">
      Studio Next is not answering right now, so this page could not read the chain. Nothing is shown rather than
      something stale. Reload in a minute.
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="panel p-6 text-center text-[14px] text-[var(--ink-3)]">{children}</div>;
}
