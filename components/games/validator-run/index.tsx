"use client";
// 10.1 Validator Run. An endless runner: you are a validator node racing along
// the chain. Stay online, collect votes, dodge faulty blocks.
import { FX } from "@/lib/engine/fx";
import { COLORS, diamond, H, hud, pad, roundRect, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

// ---- every number from section 10.1 ----
const GRAVITY = 2200; // px/s^2
const JUMP_V = 760; // px/s
const HOLD_MS = 180; // hold for a higher jump: up to 180 ms of reduced gravity
const HOLD_GRAVITY = 0.4; // fraction of gravity while the jump is held
const COYOTE = 0.08; // s
const BUFFER = 0.1; // s
const SPEED0 = 320; // px/s
const SPEED_STEP = 12; // px/s every 5 s
const SPEED_MAX = 900;
const VOTE = 25;
const PX_PER_POINT = 10;
const FLOATING_AFTER = 20; // s
const FINALITY_EVERY = 30; // s
const FINALITY_LEN = 5; // s, double points
const MAX_APPEALS = 2;

const GROUND = 420;
const PX = 150;
const SIZE = 34;

type Ob = { x: number; y: number; w: number; h: number; kind: "fault" | "float" };
type Pick = { x: number; y: number; kind: "vote" | "appeal"; got?: boolean };

export class Run implements Scene {
  t = 0;
  y = GROUND - SIZE;
  vy = 0;
  ground = true;
  sinceGround = 0;
  buffered = -1;
  holdLeft = 0;
  squash = 0;
  speed = SPEED0;
  dist = 0;
  points = 0;
  appeals = 0;
  invuln = 0;
  obs: Ob[] = [];
  picks: Pick[] = [];
  nextOb = 700;
  over = false;
  paused = false;
  votes = 0;
  fx = new FX();
  lines: { x: number; y: number; w: number }[] = Array.from({ length: 14 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * 360, w: 30 + Math.random() * 90 }));

  constructor(
    private a: string,
    private hooks: Hooks,
  ) {}

  finality() {
    const phase = this.t % FINALITY_EVERY;
    return this.t >= FINALITY_EVERY && phase < FINALITY_LEN;
  }

  spawn() {
    // Gap between obstacles scales with speed, so a jumpable path always exists:
    // at least one full jump's air time (about 0.7 s) of distance between them.
    const air = (2 * JUMP_V) / GRAVITY;
    const gap = this.speed * (air + 0.35) + Math.random() * this.speed * 0.9;
    const x = W + 40;
    const floatOk = this.t > FLOATING_AFTER && Math.random() < 0.35;
    if (floatOk) {
      // floating block: low enough that a jump hits it, high enough to run under
      const w = 50 + Math.random() * 50;
      this.obs.push({ x, y: GROUND - SIZE - 74, w, h: 26, kind: "float" });
      this.picks.push({ x: x + w / 2, y: GROUND - 18, kind: "vote" });
    } else {
      const w = 26 + Math.random() * 30;
      const h = 28 + Math.random() * 22;
      this.obs.push({ x, y: GROUND - h, w, h, kind: "fault" });
      // a vote above the block rewards a clean jump
      if (Math.random() < 0.7) this.picks.push({ x: x + w / 2, y: GROUND - h - 70 - Math.random() * 30, kind: "vote" });
    }
    if (Math.random() < 0.035 && this.appeals < MAX_APPEALS) this.picks.push({ x: x + gap / 2, y: GROUND - 120, kind: "appeal" });
    else if (Math.random() < 0.5) this.picks.push({ x: x + gap / 2, y: GROUND - 30 - Math.random() * 90, kind: "vote" });
    this.nextOb = gap;
  }

  update(dt: number, input: Input) {
    if (this.over) {
      this.fx.update(dt);
      return;
    }
    if (input.justPressed.has("KeyP")) this.paused = !this.paused;
    if (this.paused) return;
    if (!this.hooks.running()) return;

    this.t += dt;
    this.speed = Math.min(SPEED_MAX, SPEED0 + SPEED_STEP * Math.floor(this.t / 5));
    const mult = this.finality() ? 2 : 1;

    const jumpDown = input.justPressed.has("Space") || input.justPressed.has("ArrowUp") || input.justPressed.has("KeyW") || input.pointer.tapped;
    const held = input.pressed.has("Space") || input.pressed.has("ArrowUp") || input.pressed.has("KeyW") || input.pointer.down;
    if (jumpDown) this.buffered = BUFFER;
    else this.buffered -= dt;

    this.sinceGround = this.ground ? 0 : this.sinceGround + dt;
    if (this.buffered > 0 && (this.ground || this.sinceGround < COYOTE)) {
      this.vy = -JUMP_V;
      this.ground = false;
      this.sinceGround = COYOTE;
      this.buffered = -1;
      this.holdLeft = HOLD_MS / 1000;
      sfx.jump();
    }
    let g = GRAVITY;
    if (held && this.holdLeft > 0 && this.vy < 0) {
      g *= HOLD_GRAVITY;
      this.holdLeft -= dt;
    } else this.holdLeft = 0;
    this.vy += g * dt;
    this.y += this.vy * dt;
    if (this.y >= GROUND - SIZE) {
      if (!this.ground && this.vy > 300) this.squash = 0.12;
      this.y = GROUND - SIZE;
      this.vy = 0;
      this.ground = true;
    }
    this.squash = Math.max(0, this.squash - dt);

    const dx = this.speed * dt;
    this.dist += dx;
    this.points += (dx / PX_PER_POINT) * mult;
    for (const o of this.obs) o.x -= dx;
    for (const p of this.picks) p.x -= dx;
    for (const l of this.lines) {
      l.x -= dx * 0.6;
      if (l.x + l.w < 0) l.x = W + Math.random() * 200;
    }
    this.nextOb -= dx;
    if (this.nextOb <= 0) this.spawn();
    this.obs = this.obs.filter((o) => o.x + o.w > -20);
    this.picks = this.picks.filter((p) => p.x > -20 && !p.got);

    // pickups
    const cx = PX + SIZE / 2,
      cy = this.y + SIZE / 2;
    for (const p of this.picks) {
      if (Math.abs(p.x - cx) < 26 && Math.abs(p.y - cy) < 28) {
        p.got = true;
        if (p.kind === "vote") {
          this.points += VOTE * mult;
          this.votes++;
          sfx.pickup();
          this.fx.burst(p.x, p.y, this.a, 6);
          this.fx.float(p.x, p.y - 16, `+${VOTE * mult}`, this.a);
        } else {
          this.appeals = Math.min(MAX_APPEALS, this.appeals + 1);
          sfx.chord();
          this.fx.burst(p.x, p.y, this.a, 10);
          this.fx.float(p.x, p.y - 16, "APPEAL", this.a);
        }
      }
    }

    // faulty blocks
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.invuln <= 0) {
      for (const o of this.obs) {
        const hit = PX + 4 < o.x + o.w && PX + SIZE - 4 > o.x && this.y + 4 < o.y + o.h && this.y + SIZE > o.y + 2;
        if (!hit) continue;
        sfx.hit();
        this.fx.hit(120);
        this.fx.burst(PX + SIZE / 2, this.y + SIZE / 2, COLORS.danger, 10);
        if (this.appeals > 0) {
          this.appeals--;
          this.invuln = 1;
          o.x = -999;
          this.fx.float(PX + SIZE / 2, this.y - 10, "APPEAL USED", this.a);
        } else {
          this.over = true;
          this.hooks.over(this.points, { votes: this.votes, seconds: Math.floor(this.t) });
        }
        break;
      }
    }
    this.fx.update(dt);
    this.hooks.score(this.points);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (this.finality()) {
      const pulse = 0.06 + 0.05 * Math.sin(this.t * 10);
      ctx.fillStyle = withAlpha(this.a, pulse);
      ctx.fillRect(0, 0, W, H);
    }
    this.fx.pre(ctx);
    // speed lines and circuitry
    ctx.strokeStyle = withAlpha(this.a, 0.18);
    ctx.lineWidth = 2;
    for (const l of this.lines) {
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.w, l.y);
      ctx.stroke();
    }
    // the chain: ground line with block ticks
    ctx.strokeStyle = withAlpha(this.a, 0.6);
    ctx.beginPath();
    ctx.moveTo(0, GROUND + 1);
    ctx.lineTo(W, GROUND + 1);
    ctx.stroke();
    const off = this.dist % 80;
    ctx.fillStyle = withAlpha(this.a, 0.25);
    for (let x = -off; x < W; x += 80) ctx.fillRect(x, GROUND + 8, 50, 6);

    for (const o of this.obs) {
      ctx.fillStyle = COLORS.danger;
      roundRect(ctx, o.x, o.y, o.w, o.h, 4);
      ctx.fill();
    }
    for (const p of this.picks) {
      if (p.kind === "vote") diamond(ctx, p.x, p.y, 10, this.a);
      else {
        ctx.strokeStyle = this.a;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // the validator node, squashed on landing
    const sq = this.squash > 0 ? 1 - this.squash * 2 : 1;
    const w = SIZE * (2 - sq),
      h = SIZE * sq;
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    if (!blink) {
      ctx.fillStyle = this.over ? COLORS.muted : this.a;
      roundRect(ctx, PX + (SIZE - w) / 2, this.y + (SIZE - h), w, h, 9);
      ctx.fill();
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(PX + SIZE * 0.6, this.y + (SIZE - h) + h * 0.3, 5, 5);
    }
    this.fx.draw(ctx);
    ctx.restore();

    const tags = ["validator run"];
    if (this.finality()) tags.push("x2");
    if (this.appeals) tags.push(this.appeals === 1 ? "appeal" : `appeal x${this.appeals}`);
    hud(ctx, tags.join("  "), pad(this.points), this.a);
    if (this.paused) {
      ctx.fillStyle = withAlpha(COLORS.bg, 0.7);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.text;
      ctx.font = "600 22px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED. PRESS P", W / 2, H / 2);
      ctx.textAlign = "left";
    }
  }
}

export default function ValidatorRun(props: GameProps) {
  return <CanvasGame props={props} label="Validator Run game canvas" make={(a, h) => new Run(a, h)} />;
}
