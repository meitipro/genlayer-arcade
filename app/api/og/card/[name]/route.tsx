// GET /api/og/card/<name>: the card as a 1200x630 image, drawn from the same
// data My Card shows. Public like every share image, so link previews and the
// share sheet can fetch it; it carries what the public card carries.
import { ImageResponse } from "next/og";
import { cardFor } from "@/lib/card";

const BG = "#08080C",
  PANEL = "#12121A",
  LINE = "#2A2A38",
  TEXT = "#EDEDF2",
  MUTED = "#8A8A9A",
  ACCENT = "#9B7BFF",
  TINT = "#C9B8FF";

/** The avatar as a data URI, or null: a remote image that fails would fail the whole picture. */
async function avatarData(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https:\/\/cdn\.discordapp\.com\//.test(url) || /\.gif(\?|$)/.test(url)) return null;
  try {
    const r = await fetch(url.replace(/\.webp(\?|$)/, ".png$1"), { signal: AbortSignal.timeout(4000) });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !/^image\/(png|jpeg)$/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length < 600_000 ? `data:${type};base64,${buf.toString("base64")}` : null;
  } catch {
    return null;
  }
}

const n = (v: number) => v.toLocaleString("en-US");

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const raw = decodeURIComponent((await ctx.params).name);
  const card = /^[a-zA-Z0-9_]{3,20}$/.test(raw) ? await cardFor(raw) : null;
  if (!card) return new Response("no such card", { status: 404 });
  const avatar = await avatarData(card.discord?.avatar ?? card.x?.avatar);
  const member = Boolean(card.discord?.isMember);
  const roles = (card.discord?.roles ?? []).slice(0, 5);
  const more = (card.discord?.roles.length ?? 0) - roles.length;
  const cells: [string, string][] = [
    ["HIGHEST ROLE", member ? card.standing : "No server role"],
    ["ARCADE XP", n(card.xp)],
    ["BADGES", `${card.badges}/10`],
    ["DAILY GAMES", String(card.dailies)],
  ];
  const sub = `Arcade level ${card.level} · ${card.dailies} daily entries`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, padding: 40, color: TEXT }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            borderRadius: 36,
            border: `2px solid ${ACCENT}`,
            background: `linear-gradient(135deg, ${PANEL} 0%, #181326 60%, #1d1533 100%)`,
            padding: 44,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, letterSpacing: 5, color: MUTED }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 20, height: 20, borderRadius: 999, background: ACCENT }} />
              <div>GENLAYER ARCADE · CREDENTIAL</div>
            </div>
            <div style={{ display: "flex", color: TINT }}>No. {card.credentialNo}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <div style={{ display: "flex", width: 190, height: 190, borderRadius: 28, border: `3px solid ${TINT}`, background: BG, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- next/og draws a plain img
                <img src={avatar} width={190} height={190} alt="" style={{ objectFit: "cover" }} />
              ) : (
                <div style={{ display: "flex", fontSize: 96, color: ACCENT }}>{card.name.slice(0, 1).toUpperCase()}</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{card.name}</div>
              <div style={{ display: "flex", fontSize: 30, color: MUTED }}>
                {card.discord ? `@${card.discord.username}` : ""}
                {card.x ? `${card.discord ? "  ·  " : ""}X @${card.x.handle}` : ""}
              </div>
              <div style={{ display: "flex", marginTop: 8 }}>
                <div style={{ display: "flex", padding: "8px 22px", borderRadius: 999, background: ACCENT, color: BG, fontSize: 28, fontWeight: 700 }}>
                  {card.tier.name} · Tier {card.tier.n}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            {cells.map(([l, v]) => (
              <div key={l} style={{ display: "flex", flexDirection: "column", flex: 1, gap: 6, padding: "14px 20px", borderRadius: 18, border: `1px solid ${LINE}`, background: "rgba(8,8,12,0.55)" }}>
                <div style={{ display: "flex", fontSize: 18, letterSpacing: 3, color: MUTED }}>{l}</div>
                <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: TEXT }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: MUTED }}>
            <div style={{ display: "flex", gap: 10 }}>
              {roles.map((r) => (
                <div key={r} style={{ display: "flex", padding: "4px 16px", borderRadius: 999, border: `1px solid ${LINE}`, color: TINT }}>
                  {r}
                </div>
              ))}
              {more > 0 && <div style={{ display: "flex", padding: "4px 8px" }}>+{more}</div>}
              {roles.length === 0 && <div style={{ display: "flex" }}>{sub}</div>}
            </div>
            <div style={{ display: "flex", fontSize: 20 }}>{roles.length ? sub : card.recordHash.slice(0, 12)}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
