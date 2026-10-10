"use client";
// Fee Flap: one tap to flap a transaction through gaps between blocks.
import { FX } from "@/lib/engine/fx";
import { COLORS, H, hud, pad, roundRect, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

const GRAVITY = 1500;
const FLAP = -470;
const BX = 200;
const R = 16;
const PIPE_W = 70;
const GAP0 = 190;
const GAP_MIN = 150;
const SPACING = 290;
const SPEED0 = 200;
const SPEED_MAX = 270;
const PER_PIPE = 10;
const MAX_SHIFT = 130; // consecutive gaps never differ by more than a flap sequence can cover

type Pipe = { x: number; gy: number; passed: boolean };

export class Flap implements Scene {
  y = H / 2;
  vy = 0;
  t = 0;
  started = false;
  pipes: Pipe[] = [];
  passed = 0;
  over = false;
  fx = new FX();
  private last = H / 2;
  private seed: number;

  /** seed: a fixed one makes the sequence of gaps repeatable (tests); the game passes none. */
  constructor(
    private a: string,
    private hooks: Hooks,
    seed?: number,
  ) {
    this.seed = seed ?? ((Math.random() * 2 ** 31) | 1);
  }

  private rand() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  get points() {
    return this.passed * PER_PIPE;
  }
  speed() {
    return Math.min(SPEED_MAX, SPEED0 + this.t * 1.5);
  }
  gap() {
    return Math.max(GAP_MIN, GAP0 - this.passed * 1.5);
  }

  spawn() {
    const g = this.gap();
    const lo = Math.max(g / 2 + 50, this.last - MAX_SHIFT);
    const hi = Math.min(H - g / 2 - 50, this.last + MAX_SHIFT);
    const gy = lo + this.rand() * Math.max(0, hi - lo);
    this.last = gy;
    this.pipes.push({ x: W + PIPE_W, gy, passed: false });
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    if (this.over || !this.hooks.running()) return;
    const flap = input.justPressed.has("Space") || input.justPressed.has("ArrowUp") || input.justPressed.has("KeyW") || input.pointer.tapped;
    if (!this.started) {
      // hover until the first flap, so nobody loses to the start button
      this.y = H / 2 + Math.sin(performance.now() / 260) * 6;
      if (flap) {
        this.started = true;
        this.vy = FLAP;
        sfx.jump();
      }
      return;
    }
    this.t += dt;
    if (flap) {
      this.vy = FLAP;
      sfx.jump();
      this.fx.burst(BX - 10, this.y + 8, this.a, 3);
    }
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;
    const dx = this.speed() * dt;
    for (const p of this.pipes) p.x -= dx;
    const last = this.pipes[this.pipes.length - 1];
    if (!last || last.x <= W + PIPE_W - SPACING) this.spawn();
    this.pipes = this.pipes.filter((p) => p.x + PIPE_W > -10);

    if (this.y < R) {
      this.y = R;
      this.vy = 0;
    }
    let dead = this.y > H - R;
    const g = this.gap();
    for (const p of this.pipes) {
      if (!p.passed && p.x + PIPE_W < BX - R) {
        p.passed = true;
        this.passed++;
        sfx.perfect(Math.min(12, this.passed));
        this.fx.float(BX + 30, this.y - 20, `+${PER_PIPE}`, this.a);
      }
      if (BX + R > p.x && BX - R < p.x + PIPE_W && (this.y - R < p.gy - g / 2 || this.y + R > p.gy + g / 2)) dead = true;
    }
    if (dead) {
      this.over = true;
      sfx.hit();
      this.fx.hit(150);
      this.hooks.over(this.points, { pipes: this.passed, n: this.passed });
      return;
    }
    this.hooks.score(this.points);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    this.fx.pre(ctx);
    const g = this.gap();
    for (const p of this.pipes) {
      ctx.fillStyle = withAlpha(this.a, 0.22);
      ctx.strokeStyle = this.a;
      ctx.lineWidth = 3;
      roundRect(ctx, p.x, -10, PIPE_W, p.gy - g / 2 + 10, 8);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, p.x, p.gy + g / 2, PIPE_W, H - (p.gy + g / 2) + 10, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = this.over ? COLORS.danger : this.a;
    ctx.save();
    ctx.translate(BX, this.y);
    ctx.rotate(Math.max(-0.5, Math.min(0.9, this.vy / 700)));
    roundRect(ctx, -R, -R, R * 2, R * 2, 7);
    ctx.fill();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(4, -6, 5, 5);
    ctx.restore();
    if (!this.started) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = "600 15px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("TAP, CLICK OR PRESS SPACE TO FLAP", W / 2, H / 2 + 70);
      ctx.textAlign = "left";
    }
    this.fx.draw(ctx);
    ctx.restore();
    hud(ctx, `fee flap  blocks ${this.passed}`, pad(this.points), this.a);
  }
}

export default function FeeFlap(props: GameProps) {
  return <CanvasGame props={props} label="Fee Flap game canvas" make={(a, h) => new Flap(a, h)} />;
}
