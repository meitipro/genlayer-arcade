"use client";
// UNDETERMINED: a teaser level (section 20, "Day two and three": reusing the
// Ink and Neon, The Vault and Contagion art). Three rooms, one fragment in
// each, an exit gate at the end. Not scored and not on any board.
import { useEffect, useRef, useState } from "react";
import { FX } from "@/lib/engine/fx";
import { COLORS, diamond, H, roundRect, startLoop, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";

const ZONES = [
  { name: "ink and neon", accent: "#3FE0FF" },
  { name: "the vault", accent: "#9B7BFF" },
  { name: "contagion", accent: "#FF4FD8" },
];
const ROOM = W; // each zone is one screen wide
const WORLD = ROOM * ZONES.length;
const GROUND = 440;
const GRAVITY = 2000,
  JUMP = 720,
  RUN = 300,
  SIZE = 28;

type Rect = { x: number; y: number; w: number; h: number };
// platforms and hazards per room, in world coordinates
const PLATFORMS: Rect[] = [
  { x: 0, y: GROUND, w: 330, h: 60 },
  { x: 420, y: GROUND, w: 380, h: 60 },
  { x: 220, y: 340, w: 120, h: 14 },
  { x: 470, y: 270, w: 140, h: 14 },
  // the vault
  { x: ROOM, y: GROUND, w: 260, h: 60 },
  { x: ROOM + 330, y: 380, w: 110, h: 14 },
  { x: ROOM + 500, y: 310, w: 110, h: 14 },
  { x: ROOM + 660, y: GROUND, w: 140, h: 60 },
  { x: ROOM + 640, y: 220, w: 120, h: 14 },
  // contagion
  { x: ROOM * 2, y: GROUND, w: 200, h: 60 },
  { x: ROOM * 2 + 260, y: 370, w: 100, h: 14 },
  { x: ROOM * 2 + 420, y: 300, w: 100, h: 14 },
  { x: ROOM * 2 + 580, y: GROUND, w: 220, h: 60 },
];
const SPIKES: Rect[] = [
  { x: 330, y: GROUND + 20, w: 90, h: 40 },
  { x: ROOM + 260, y: GROUND + 20, w: 400, h: 40 },
  { x: ROOM * 2 + 200, y: GROUND + 20, w: 380, h: 40 },
  { x: ROOM * 2 + 640, y: GROUND - 18, w: 40, h: 18 },
];
const FRAGMENTS = [
  { x: 540, y: 230 },
  { x: ROOM + 700, y: 180 },
  { x: ROOM * 2 + 470, y: 260 },
];
const GATE = { x: WORLD - 80, y: GROUND - 90, w: 40, h: 90 };
const CHECKPOINTS = [60, ROOM + 60, ROOM * 2 + 60];

export class Teaser implements Scene {
  x = 60;
  y = GROUND - SIZE;
  vy = 0;
  ground = false;
  cam = 0;
  got = [false, false, false];
  done = false;
  deaths = 0;
  t = 0;
  fx = new FX();
  constructor(private onDone: (deaths: number, seconds: number) => void) {}

  zone() {
    return Math.min(ZONES.length - 1, Math.max(0, Math.floor((this.x + SIZE / 2) / ROOM)));
  }

  respawn() {
    this.deaths++;
    sfx.hit();
    this.fx.hit(120);
    this.x = CHECKPOINTS[this.zone()];
    this.y = GROUND - SIZE - 40;
    this.vy = 0;
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    if (this.done) return;
    this.t += dt;
    const p = input.pointer;
    const left = input.pressed.has("ArrowLeft") || input.pressed.has("KeyA") || (p.down && p.x < W / 3);
    const right = input.pressed.has("ArrowRight") || input.pressed.has("KeyD") || (p.down && p.x > (W * 2) / 3);
    const jump =
      input.justPressed.has("Space") || input.justPressed.has("ArrowUp") || input.justPressed.has("KeyW") || input.swipe === "up" || (p.tapped && p.x >= W / 3 && p.x <= (W * 2) / 3);
    const dx = ((right ? 1 : 0) - (left ? 1 : 0)) * RUN * dt;
    if (jump && this.ground) {
      this.vy = -JUMP;
      this.ground = false;
      sfx.jump();
    }
    // horizontal, then vertical, each resolved against platforms
    this.x = Math.max(0, Math.min(WORLD - SIZE, this.x + dx));
    for (const r of PLATFORMS) if (this.hits(r)) this.x = dx > 0 ? r.x - SIZE : r.x + r.w;
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;
    this.ground = false;
    for (const r of PLATFORMS) {
      if (!this.hits(r)) continue;
      if (this.vy > 0) {
        this.y = r.y - SIZE;
        this.ground = true;
      } else this.y = r.y + r.h;
      this.vy = 0;
    }
    if (this.y > H + 40 || SPIKES.some((s) => this.hits(s))) this.respawn();
    FRAGMENTS.forEach((f, i) => {
      if (!this.got[i] && Math.abs(this.x + SIZE / 2 - f.x) < 24 && Math.abs(this.y + SIZE / 2 - f.y) < 26) {
        this.got[i] = true;
        sfx.chord();
        this.fx.burst(f.x, f.y, ZONES[i].accent, 10);
      }
    });
    if (this.got.every(Boolean) && this.hits(GATE)) {
      this.done = true;
      sfx.arpeggio();
      this.onDone(this.deaths, Math.round(this.t));
    }
    const target = Math.max(0, Math.min(WORLD - W, this.x - W / 2));
    this.cam += (target - this.cam) * Math.min(1, dt * 6);
  }

  hits(r: Rect) {
    return this.x < r.x + r.w && this.x + SIZE > r.x && this.y < r.y + r.h && this.y + SIZE > r.y;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const z = ZONES[this.zone()];
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    this.fx.pre(ctx);
    ctx.translate(-this.cam, 0);
    ZONES.forEach((zone, i) => {
      const x0 = i * ROOM;
      ctx.strokeStyle = withAlpha(zone.accent, 0.08);
      ctx.lineWidth = 1;
      if (i === 0)
        for (let k = 0; k < 14; k++) {
          ctx.beginPath();
          ctx.moveTo(x0 + k * 60, 40 + (k % 5) * 70);
          ctx.lineTo(x0 + k * 60 + 120, 40 + (k % 5) * 70);
          ctx.stroke();
        }
      if (i === 1) for (let k = 0; k < 8; k++) ctx.strokeRect(x0 + 30 + k * 95, 50, 60, 330);
      if (i === 2) {
        ctx.fillStyle = withAlpha(zone.accent, 0.04);
        for (let y = 0; y < H; y += 6) ctx.fillRect(x0, y, ROOM, 2);
      }
    });
    for (const r of PLATFORMS) {
      ctx.fillStyle = withAlpha(ZONES[Math.min(2, Math.floor(r.x / ROOM))].accent, 0.55);
      roundRect(ctx, r.x, r.y, r.w, r.h, 4);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.danger;
    for (const s of SPIKES) {
      const n = Math.max(1, Math.floor(s.w / 18));
      for (let k = 0; k < n; k++) {
        ctx.beginPath();
        ctx.moveTo(s.x + k * (s.w / n), s.y + s.h);
        ctx.lineTo(s.x + (k + 0.5) * (s.w / n), s.y);
        ctx.lineTo(s.x + (k + 1) * (s.w / n), s.y + s.h);
        ctx.fill();
      }
    }
    FRAGMENTS.forEach((f, i) => !this.got[i] && diamond(ctx, f.x, f.y + Math.sin(this.t * 3 + i) * 4, 11, ZONES[i].accent, true));
    ctx.strokeStyle = this.got.every(Boolean) ? z.accent : COLORS.muted;
    ctx.lineWidth = 3;
    roundRect(ctx, GATE.x, GATE.y, GATE.w, GATE.h, 8);
    ctx.stroke();
    ctx.fillStyle = z.accent;
    roundRect(ctx, this.x, this.y, SIZE, SIZE, 8);
    ctx.fill();
    this.fx.draw(ctx);
    ctx.restore();
    ctx.font = "600 16px 'JetBrains Mono', monospace";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`UNDETERMINED · ${z.name.toUpperCase()}`, 20, 18);
    ctx.textAlign = "right";
    ctx.fillStyle = z.accent;
    ctx.fillText(`fragments ${this.got.filter(Boolean).length}/3`, W - 20, 18);
    ctx.textAlign = "left";
  }
}

export default function Undetermined() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  const [end, setEnd] = useState<{ deaths: number; seconds: number } | null>(null);
  useEffect(() => {
    setEnd(null);
    const scene = new Teaser((deaths, seconds) => setEnd({ deaths, seconds }));
    ref.current!.focus({ preventScroll: true });
    return startLoop(ref.current!, scene);
  }, [run]);
  return (
    <div className="card relative overflow-hidden">
      <canvas ref={ref} tabIndex={0} aria-label="UNDETERMINED teaser level" className="block aspect-[16/10] w-full touch-none select-none bg-bg outline-none" />
      {end && (
        <div className="absolute inset-0 grid place-items-center bg-bg/85 p-4 text-center">
          <div className="space-y-3">
            <p className="mono text-xs uppercase tracking-widest text-accent">three fragments recovered</p>
            <p className="display text-3xl font-bold">UNDETERMINED</p>
            <p className="text-muted">The rest of the world is not decided yet.</p>
            <p className="mono text-sm text-muted">
              {end.seconds}s · {end.deaths} {end.deaths === 1 ? "fall" : "falls"}
            </p>
            <button className="btn btn-primary" onClick={() => setRun((n) => n + 1)}>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
