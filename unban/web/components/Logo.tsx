/** The Unban mark: a check that leaves its circle, the second look. Same drawing as public/logo.svg. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M50.6 18.4A24 24 0 1 0 56 32" fill="none" stroke="#FBBF24" strokeWidth="6" strokeLinecap="round" />
      <path d="M20 32.5l9 9L58 12.5" fill="none" stroke="#FBBF24" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Mark size={24} />
      <span className="text-[19px] font-semibold tracking-tight text-[var(--ink)]">unban</span>
    </span>
  );
}
