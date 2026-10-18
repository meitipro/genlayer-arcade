import Link from "next/link";

/** Shown in place of chain data that could not be read. Never a placeholder row. */
export function Unavailable({ message, deployLink = false }: { message: string; deployLink?: boolean }) {
  return (
    <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="eyebrow">Nothing to show</span>
      <p className="muted" style={{ margin: 0 }}>{message}</p>
      {deployLink ? (
        <p style={{ margin: 0 }}>
          <Link href="/deploy" style={{ color: "var(--amber)" }}>Deploy the contract from your wallet</Link>, or read{" "}
          <Link href="/docs/reference/addresses" style={{ color: "var(--amber)" }}>Addresses and network</Link>.
        </p>
      ) : null}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card pad dim" style={{ fontSize: 14 }}>{children}</div>;
}
