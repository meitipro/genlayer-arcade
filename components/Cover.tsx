// Game covers drawn as SVG: background, game title, one accent shape from the
// game's own mock (section 6, "Covers"). 16:9, no image files.
import type { Game } from "@/lib/games";

function Shape({ slug, a }: { slug: string; a: string }) {
  switch (slug) {
    case "validator-run":
      return (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={40 + i * 30} y1={190 + i * 12} x2={130 + i * 30} y2={190 + i * 12} stroke={a} strokeOpacity={0.35} strokeWidth={3} />
          ))}
          <rect x={170} y={170} width={44} height={44} rx={10} fill={a} />
          <path d="M268 150 l16 16 -16 16 -16 -16z" fill="none" stroke={a} strokeWidth={3} />
          <rect x={300} y={196} width={30} height={30} rx={4} fill="#FF5C7A" />
          <line x1={0} y1={228} x2={400} y2={228} stroke={a} strokeOpacity={0.5} strokeWidth={2} />
        </g>
      );
    case "consensus-stack":
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={140 + i * 4} y={200 - i * 22} width={120 - i * 8} height={20} rx={3} fill={a} fillOpacity={0.35 + i * 0.15} />
          ))}
          <rect x={186} y={78} width={88} height={20} rx={3} fill={a} />
        </g>
      );
    case "leader-rotation":
      return (
        <g>
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2].map((c) => {
              const lead = r === 1 && c === 1;
              const bad = r === 0 && c === 2;
              return (
                <rect key={`${r}${c}`} x={150 + c * 36} y={90 + r * 36} width={28} height={28} rx={8} fill={lead ? a : bad ? "#FF5C7A" : "#23232F"} />
              );
            }),
          )}
          <rect x={144} y={120} width={40} height={40} rx={12} fill="none" stroke={a} strokeOpacity={0.5} strokeWidth={2} transform="translate(36 0)" />
        </g>
      );
    case "equivalence":
      return (
        <g>
          <rect x={120} y={92} width={74} height={96} rx={10} fill="#1C1C27" stroke={a} strokeWidth={2} />
          <rect x={206} y={92} width={74} height={96} rx={10} fill="#1C1C27" stroke={a} strokeWidth={2} />
          <text x={157} y={145} textAnchor="middle" fill={a} fontSize={14} fontFamily="JetBrains Mono, monospace">$100</text>
          <text x={243} y={145} textAnchor="middle" fill={a} fontSize={11} fontFamily="JetBrains Mono, monospace">one hundred</text>
        </g>
      );
    case "chain-snake":
      return (
        <g>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect
              key={i}
              x={110 + i * 26}
              y={140}
              width={22}
              height={22}
              rx={4}
              fill={i < 4 ? "none" : a}
              stroke={a}
              strokeWidth={2}
              fillOpacity={i < 4 ? 0 : 1}
            />
          ))}
          <circle cx={320} cy={151} r={9} fill="none" stroke={a} strokeWidth={3} />
        </g>
      );
    case "appeal-breaker":
      return (
        <g>
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2, 3, 4].map((c) => (
              <rect key={`${r}${c}`} x={110 + c * 38} y={70 + r * 22} width={32} height={16} rx={3} fill={a} fillOpacity={1 - r * 0.3} />
            )),
          )}
          <circle cx={210} cy={170} r={7} fill={a} />
          <rect x={170} y={208} width={80} height={10} rx={5} fill={a} />
        </g>
      );
    case "verdict":
      return (
        <g>
          <text x={200} y={150} textAnchor="middle" fill={a} fontSize={56} fontWeight={700} fontFamily="JetBrains Mono, monospace">8/10</text>
          <text x={200} y={186} textAnchor="middle" fill="#8A8A9A" fontSize={13} fontFamily="JetBrains Mono, monospace">ACCEPTED  4 OF 5 AGREE</text>
        </g>
      );
    case "bridge":
      return (
        <g>
          {["ocean", "salt", "pepper", "mill"].map((w, i) => (
            <g key={w}>
              <rect x={60 + i * 75} y={128} width={64} height={30} rx={15} fill="#1C1C27" stroke={a} strokeWidth={2} />
              <text x={92 + i * 75} y={148} textAnchor="middle" fill="#EDEDF2" fontSize={12} fontFamily="JetBrains Mono, monospace">{w}</text>
              {i < 3 && <line x1={124 + i * 75} y1={143} x2={135 + i * 75} y2={143} stroke={a} strokeWidth={2} />}
            </g>
          ))}
        </g>
      );
    case "oracle":
      return (
        <g>
          <line x1={80} y1={160} x2={320} y2={160} stroke="#23232F" strokeWidth={2} />
          {[100, 160, 205, 290].map((x, i) => (
            <circle key={x} cx={x} cy={160} r={i === 2 ? 9 : 6} fill={i === 2 ? a : "#23232F"} stroke={a} strokeWidth={2} />
          ))}
          <path d="M205 120 v26" stroke={a} strokeWidth={2} />
          <text x={205} y={112} textAnchor="middle" fill={a} fontSize={13} fontFamily="JetBrains Mono, monospace">LIVE</text>
        </g>
      );
    default:
      return <circle cx={200} cy={150} r={40} fill={a} />;
  }
}

export function Cover({ game, className = "" }: { game: Game; className?: string }) {
  return (
    <svg viewBox="0 0 400 225" className={className} role="img" aria-label={`${game.title} cover`}>
      <rect width={400} height={225} fill="#12121A" />
      <g opacity={0.5}>
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={i} x1={i * 50} y1={0} x2={i * 50} y2={225} stroke="#1C1C27" />
        ))}
      </g>
      <Shape slug={game.slug} a={game.accent} />
      <text x={18} y={30} fill="#EDEDF2" fontSize={17} fontWeight={700} fontFamily="Space Grotesk, sans-serif" letterSpacing={-0.3}>
        {game.title}
      </text>
    </svg>
  );
}
