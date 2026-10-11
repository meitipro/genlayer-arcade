"use client";
// The player card. Ported from meitipro/genlayer-cards (components/CredentialCard.tsx):
// the same 3D tilt and flip, glare, engraved artwork, tier badge, portrait,
// record hash and seal on the front, and the dossier on the back with the
// roles to tap. The data is this hub's: Discord roles, verified handles and
// arcade standing. The palette is this site's (credential-card.css).
import { useCallback, useEffect, useRef, useState } from "react";
import { guillocheSVG, sealSVG } from "@/lib/cardSvg";
import type { PlayerCard } from "@/lib/cardTypes";
import { CARD_INTRO, roleHowEarned, tierDoctrine } from "@/lib/lore";
import GenLogo from "./GenLogo";
import "./credential-card.css";

function Svg({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function tenure(joinedAt: string | null | undefined): string | null {
  if (!joinedAt) return null;
  const d = new Date(joinedAt);
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 0) return null;
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}

function shortDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default function CredentialCard({
  data,
  hideFlipButton = false,
  flipSignal = 0,
  frontRef,
}: {
  data: PlayerCard;
  hideFlipButton?: boolean;
  /** Bump this to flip the card from outside. */
  flipSignal?: number;
  /** The front face, for drawing the card into a picture. */
  frontRef?: React.Ref<HTMLDivElement>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const discord = data.discord;
  const portrait = discord?.avatar || data.x?.avatar || null;

  const dragging = useRef(false);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0, rx: 0, ry: 0 });
  const [rot, setRot] = useState({ rx: 0, ry: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, on: false });
  const [flipped, setFlipped] = useState(false);
  const [roleInfo, setRoleInfo] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // flip when the parent bumps flipSignal; the first value leaves the card facing front
  const seenSignal = useRef(flipSignal);
  useEffect(() => {
    if (flipSignal === seenSignal.current) return;
    seenSignal.current = flipSignal;
    setFlipped((f) => !f);
  }, [flipSignal]);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el || reduced) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      setGlare({ x: px * 100, y: py * 100, on: true });
      if (dragging.current) {
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true;
        setRot({ ry: start.current.ry + dx * 0.4, rx: start.current.rx - dy * 0.4 });
      } else {
        setRot({ ry: (px - 0.5) * 16, rx: -(py - 0.5) * 16 });
      }
    },
    [reduced],
  );

  const onLeave = useCallback(() => {
    if (dragging.current) return;
    setRot({ rx: 0, ry: 0 });
    setGlare((g) => ({ ...g, on: false }));
  }, []);

  const onDown = useCallback(
    (e: React.MouseEvent) => {
      if (reduced) return;
      dragging.current = true;
      moved.current = false;
      start.current = { x: e.clientX, y: e.clientY, rx: rot.rx, ry: rot.ry };
    },
    [reduced, rot],
  );

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setRot({ rx: 0, ry: 0 });
    setGlare((g) => ({ ...g, on: false }));
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      dragging.current = true;
      moved.current = false;
      start.current = { x: t.clientX, y: t.clientY, rx: rot.rx, ry: rot.ry };
    },
    [rot],
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true;
    setRot({ ry: start.current.ry + dx * 0.4, rx: start.current.rx - dy * 0.4 });
  }, []);

  const ry = flipped ? rot.ry + 180 : rot.ry;
  const transform = `rotateX(${rot.rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;

  // roles: the highest one first, then the rest, no repeats
  const roleList = Array.from(new Set([discord?.isMember ? discord.highestRole : "", ...(discord?.roles ?? [])].filter(Boolean))).slice(0, 8);
  const memberSince = shortDate(discord?.joinedAt);
  const ten = tenure(discord?.joinedAt);
  const xSince = shortDate(data.x?.since);

  return (
    <div className="cred-wrap">
      <div
        className={`flip3d${flipped ? " is-flipped" : ""}`}
        ref={ref}
        style={{ transform, transition: dragging.current ? "none" : "transform .75s cubic-bezier(.2,.8,.25,1)" }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onMouseDown={onDown}
        onMouseUp={endDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={endDrag}
      >
        {/* FRONT */}
        <div className="cred face-front" ref={frontRef}>
          <Svg html={guillocheSVG(data.seed)} />
          <div
            className="holo"
            style={{
              opacity: glare.on && !flipped ? 1 : 0,
              background: `radial-gradient(380px circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,.14), rgba(155,123,255,.12) 30%, transparent 60%)`,
            }}
          />
          <div className="edge" />
          <div className="cred-pad">
            <div className="cc-top">
              <div className="cc-iss">
                <span className="cc-logo">
                  <GenLogo size={22} color="var(--bone)" />
                </span>
                <div>
                  <b>GenLayer</b>
                  <span>Arcade Card</span>
                </div>
              </div>
              <div className="cc-no">
                <span>Card №</span>GL-{data.credentialNo}
              </div>
            </div>
            <div className="cc-tier">
              <div className="badge">
                <div className="lab">Tier</div>
                <div className="num">{data.tier.n}</div>
              </div>
              <div className="tname">
                <div className="nm">{data.tier.name}</div>
                <div className="hl">
                  <span className="pip" />
                  Standing - {data.standing}
                </div>
              </div>
            </div>
            <div className="cc-holder">
              <div className="portrait">
                {portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote avatar from Discord or X
                  <img src={portrait} alt={discord?.username || data.name} referrerPolicy="no-referrer" />
                ) : null}
                <i className="c1" />
                <i className="c2" />
                <i className="c3" />
                <i className="c4" />
              </div>
              <div className="h">
                <div className="x">{data.name}</div>
                <div className="d">@{discord?.username || data.x?.handle || data.name}</div>
              </div>
            </div>
            <div className="cc-stats">
              <div className="cell">
                <div className="l">Highest role</div>
                <div className="v">{data.standing}</div>
              </div>
              <div className="cell">
                <div className="l">Arcade XP</div>
                <div className="v">{data.xp.toLocaleString("en-US")}</div>
              </div>
            </div>
            <div className="cc-foot">
              <div className="cc-hash">
                <b>Record hash</b>
                {data.recordHash}
              </div>
              <Svg className="seal" html={sealSVG()} />
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="cred face-back">
          <Svg html={guillocheSVG(data.seed + "::back")} />
          <div className="back-veil" />
          <div className="edge" />
          <div className="cb-pad">
            <div className="cb-top">
              <div className="cb-eyebrow">About this card</div>
              <div className="cb-no">GL-{data.credentialNo}</div>
            </div>
            <p className="cb-intro">{CARD_INTRO}</p>
            <div className="cb-doctrine">
              <span className="cb-tier">
                Tier {data.tier.n} - {data.tier.name}
              </span>
              <span className="cb-doc">{tierDoctrine(data.tier.name)}</span>
            </div>
            <div className="cb-block">
              <div className="cb-label">Roles - tap one to see how it was earned</div>
              <div className="cb-chips">
                {roleList.length === 0 && <span className="cb-chip">no role found in the server</span>}
                {roleList.map((r, i) => (
                  <button
                    key={r}
                    type="button"
                    className={`cb-chip cb-chip-btn${i === 0 ? " lead" : ""}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoleInfo(r);
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="cb-service">
              <div className="cb-cell">
                <div className="l">In server since</div>
                <div className="v">{memberSince ?? "Not in server"}</div>
              </div>
              {ten && (
                <div className="cb-cell">
                  <div className="l">Tenure</div>
                  <div className="v" suppressHydrationWarning>
                    {ten}
                  </div>
                </div>
              )}
              {xSince && (
                <div className="cb-cell">
                  <div className="l">X account since</div>
                  <div className="v">{xSince}</div>
                </div>
              )}
              <div className="cb-cell">
                <div className="l">Arcade level - XP</div>
                <div className="v">
                  {data.level} - {data.xp.toLocaleString("en-US")}
                </div>
              </div>
              <div className="cb-cell">
                <div className="l">Badges</div>
                <div className="v">{data.badges}/10</div>
              </div>
              <div className="cb-cell">
                <div className="l">Daily games</div>
                <div className="v">{data.dailies}</div>
              </div>
              {data.best && (
                <div className="cb-cell">
                  <div className="l">Best run</div>
                  <div className="v">
                    {data.best.score.toLocaleString("en-US")} - {data.best.title}
                  </div>
                </div>
              )}
            </div>
            <div className="cb-linked">
              {discord && (
                <span className="cb-link-chip">
                  Discord <b>✓</b>
                </span>
              )}
              {data.x && (
                <span className="cb-link-chip">
                  X / Twitter <b>✓</b>
                </span>
              )}
              {data.wallet && (
                <span className="cb-link-chip">
                  Wallet <b>✓</b>
                </span>
              )}
            </div>
            <div className="cb-foot">
              <div className="cb-hashwrap">
                <div className="cb-label">Record hash</div>
                <div className="cb-hash">{data.recordHash}</div>
                <div className="cb-verify">Hash of this card&apos;s data. Not minted.</div>
              </div>
              <Svg className="seal" html={sealSVG()} />
            </div>
          </div>
        </div>
      </div>

      {!hideFlipButton && (
        <button type="button" className="cred-flip-btn" onClick={() => setFlipped((f) => !f)}>
          {flipped ? "↺ Front of card" : "↻ View details"}
        </button>
      )}

      {roleInfo && (
        <div className="role-modal-backdrop" onClick={() => setRoleInfo(null)} role="presentation">
          <div className="role-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${roleInfo} role`}>
            <div className="role-modal-tag">Role</div>
            <h3 className="role-modal-name">{roleInfo}</h3>
            <div className="role-modal-label">How it was earned</div>
            <p className="role-modal-desc">{roleHowEarned(roleInfo)}</p>
            <button type="button" className="role-close" onClick={() => setRoleInfo(null)} autoFocus>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
