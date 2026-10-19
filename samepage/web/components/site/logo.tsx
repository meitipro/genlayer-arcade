/** Two lines of text that become one: the mark, in the one accent. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="4" fill="none" stroke="#2DD4BF" strokeWidth="4" />
      <rect x="14" y="20" width="22" height="6" rx="1" fill="#2DD4BF" />
      <rect x="28" y="38" width="22" height="6" rx="1" fill="#2DD4BF" />
      <rect x="14" y="29" width="36" height="6" rx="1" fill="#E8ECEF" />
    </svg>
  );
}
