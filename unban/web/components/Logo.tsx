/** The Unban mark: a ring opened at the top right, with a check. Amber on the dark ground. */
export function Mark({ size = 22, color = "var(--amber)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M26.5 9.5A12 12 0 1 0 28 16" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M10 16.5l4.2 4.2L23 11.5" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 19, letterSpacing: "-.02em", color: "var(--ink)" }}>
      <Mark />
      unban
    </span>
  );
}
