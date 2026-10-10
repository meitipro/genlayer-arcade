// Tier B share cards: /api/og/home, /api/og/game/<slug>, /api/og/score/<slug>/<score>/<name>
import { ImageResponse } from "next/og";
import { gameBySlug } from "@/lib/games";

export const runtime = "edge";

const BG = "#08080C",
  TEXT = "#EDEDF2",
  MUTED = "#8A8A9A",
  HUB = "#9B7BFF";

export async function GET(_req: Request, ctx: { params: Promise<{ parts: string[] }> }) {
  const parts = (await ctx.params).parts ?? [];
  const [kind, slug, scoreRaw, nameRaw] = parts;
  const g = slug ? gameBySlug(slug) : undefined;
  const accent = g?.accent ?? HUB;
  let eyebrow = "COMMUNITY GAMING HUB";
  let big = "Play, compete, get judged by consensus.";
  let small = "Nine games built around how GenLayer works.";
  if (kind === "game" && g) {
    eyebrow = g.type === "onchain" ? "DAILY ON-CHAIN GAME" : "ARCADE";
    big = g.title;
    small = g.idea;
  }
  if (kind === "score" && g) {
    const n = Math.max(0, Math.min(g.scoring?.cap ?? 0, Math.floor(Number(scoreRaw) || 0)));
    const who = /^[a-zA-Z0-9_]{3,20}$/.test(decodeURIComponent(nameRaw ?? "")) ? decodeURIComponent(nameRaw!) : "a player";
    eyebrow = g.title.toUpperCase();
    big = n.toLocaleString("en-US");
    small = `${who} on GenLayer Arcade`;
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BG, padding: 72, color: TEXT }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, background: accent }} />
          <div style={{ fontSize: 28, color: MUTED, letterSpacing: 4 }}>{eyebrow}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: kind === "score" ? 180 : 84, fontWeight: 700, color: kind === "score" ? accent : TEXT, lineHeight: 1.05 }}>{big}</div>
          <div style={{ fontSize: 34, color: MUTED }}>{small}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30 }}>
          <div style={{ display: "flex", fontWeight: 700 }}>
            GenLayer <span style={{ color: HUB, marginLeft: 10 }}>Arcade</span>
          </div>
          <div style={{ color: MUTED }}>community-built</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
