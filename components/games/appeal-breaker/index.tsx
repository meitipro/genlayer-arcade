"use client";
// 10.6 Appeal Breaker (Tier B). Breakout where the bricks are undetermined
// transactions; harder bricks need more validators (hits) to resolve.
import waves from "@/data/breaker-waves.json";
import { FX } from "@/lib/engine/fx";
import { COLORS, H, hud, pad, roundRect, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

// ---- every number from section 10.6 ----
const PER_HP = 15; // brick resolved: +15 per hit point
const WAVE_SPEEDUP = 1.06; // ball speed +6% per wave
const BALLS = 3; // three balls lost ends the run
const WIDEN_S = 10; // bigger set widens the paddle for 10 s
const BALL_V0 = 380; // px/s
const PADDLE_W = 110,
  PADDLE_WIDE = 170,
  PADDLE_Y = 462,
  PADDLE_H = 12;
const KEY_SPEED = 620;
const BRICK_W = 70,
  BRICK_H = 22,
  GAPX = 6,
  GAPY = 6,
  TOP = 64;
const X0 = (W - (10 * BRICK_W + 9 * GAPX)) / 2;
const DROP_CHANCE = 0.12;

type Brick = { x: number; y: number; hp: number; max: number; flash: number };
type Ball = { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[]; stuck: boolean };
type Drop = { x: number; y: number; kind: "appeal" | "set" };

export class Breaker implements Scene {
  wave = 0;
  bricks: Brick[] = [];
  balls: Ball[] = [];
  drops: Drop[] = [];
  px = W / 2;
  wide = 0;
  lives = BALLS;
  points = 0;
  resolved = 0;
  over = false;
  lastPointerX = 0; // the loop starts the pointer at x=0; only a real move steers
  fx = new FX();

  constructor(
    private a: string,
    private hooks: Hooks,
  ) {
    this.load(0);
  }

  speed() {
    return BALL_V0 * Math.pow(WAVE_SPEEDUP, this.wave);
  }
  pw() {
    return this.wide > 0 ? PADDLE_WIDE : PADDLE_W;
  }

  load(i: number) {
    this.wave = i;
    this.bricks = [];
    waves[i].rows.forEach((row: string, r: number) => {
      [...row].forEach((ch, c) => {
        const hp = Number(ch);
        if (hp > 0) this.bricks.push({ x: X0 + c * (BRICK_W + GAPX), y: TOP + r * (BRICK_H + GAPY), hp, max: hp, flash: 0 });
      });
    });
    this.drops = [];
    this.balls = [this.newBall()];
  }

  newBall(): Ball {
    return { x: this.px, y: PADDLE_Y - 10, vx: 0, vy: 0, trail: [], stuck: true };
  }

  launch(b: Ball) {
    const ang = (-Math.PI / 2) + (Math.random() - 0.5) * 0.6;
    b.vx = Math.cos(ang) * this.speed();
    b.vy = Math.sin(ang) * this.speed();
    b.stuck = false;
  }

  end() {
    this.over = true;
    this.hooks.over(this.points, { wave: this.wave + 1, resolved: this.resolved, n: this.resolved });
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    for (const b of this.bricks) b.flash = Math.max(0, b.flash - dt);
    if (this.over || !this.hooks.running()) return;
    this.wide = Math.max(0, this.wide - dt);

    // paddle: pointer drag / mouse, or arrow keys
    if (input.pointer.x !== this.lastPointerX) {
      this.lastPointerX = input.pointer.x;
      if (this.lastPointerX >= 0) this.px = input.pointer.x;
    }
    if (input.pressed.has("ArrowLeft") || input.pressed.has("KeyA")) this.px -= KEY_SPEED * dt;
    if (input.pressed.has("ArrowRight") || input.pressed.has("KeyD")) this.px += KEY_SPEED * dt;
    const half = this.pw() / 2;
    this.px = Math.max(half, Math.min(W - half, this.px));

    const launch = input.justPressed.has("Space") || input.pointer.tapped;
    for (const b of this.balls) {
      if (b.stuck) {
        b.x = this.px;
        b.y = PADDLE_Y - 10;
        if (launch) this.launch(b);
        continue;
      }
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 6) b.trail.shift();
      this.move(b, dt);
    }

    // lost balls
    const before = this.balls.length;
    this.balls = this.balls.filter((b) => b.y < H + 20);
    if (this.balls.length < before && this.balls.length === 0) {
      this.lives--;
      sfx.lost();
      this.fx.hit(120);
      if (this.lives <= 0) return this.end();
      this.balls = [this.newBall()];
    }

    // power-ups
    for (const d of this.drops) d.y += 170 * dt;
    for (const d of this.drops) {
      if (d.y > PADDLE_Y - 8 && d.y < PADDLE_Y + PADDLE_H && Math.abs(d.x - this.px) < half + 10) {
        d.y = H + 100;
        if (d.kind === "set") {
          this.wide = WIDEN_S;
          this.fx.float(this.px, PADDLE_Y - 20, "BIGGER SET", this.a);
        } else {
          // appeal: the ball splits into two
          const src = this.balls.find((b) => !b.stuck) ?? this.balls[0];
          if (src && !src.stuck) {
            this.balls.push({ x: src.x, y: src.y, vx: -src.vx, vy: src.vy, trail: [], stuck: false });
          }
          this.fx.float(this.px, PADDLE_Y - 20, "APPEAL", this.a);
        }
        sfx.chord();
      }
    }
    this.drops = this.drops.filter((d) => d.y < H + 20);

    if (!this.bricks.length) {
      if (this.wave + 1 >= waves.length) return this.end();
      this.fx.float(W / 2, H / 2, `WAVE ${this.wave + 2}`, this.a);
      this.load(this.wave + 1);
    }
    this.hooks.score(this.points);
  }

  move(b: Ball, dt: number) {
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      if (b.x < 7) {
        b.x = 7;
        b.vx = Math.abs(b.vx);
      }
      if (b.x > W - 7) {
        b.x = W - 7;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y < 40) {
        b.y = 40;
        b.vy = Math.abs(b.vy);
      }
      // paddle
      const half = this.pw() / 2;
      if (b.vy > 0 && b.y > PADDLE_Y - 7 && b.y < PADDLE_Y + PADDLE_H && Math.abs(b.x - this.px) < half + 6) {
        const rel = (b.x - this.px) / half; // -1..1
        const ang = -Math.PI / 2 + rel * 1.05;
        const v = this.speed();
        b.vx = Math.cos(ang) * v;
        b.vy = Math.sin(ang) * v;
        b.y = PADDLE_Y - 7;
        sfx.bounce();
      }
      // bricks
      for (const k of this.bricks) {
        if (k.hp <= 0) continue;
        if (b.x + 6 < k.x || b.x - 6 > k.x + BRICK_W || b.y + 6 < k.y || b.y - 6 > k.y + BRICK_H) continue;
        const overlapX = Math.min(b.x + 6 - k.x, k.x + BRICK_W - (b.x - 6));
        const overlapY = Math.min(b.y + 6 - k.y, k.y + BRICK_H - (b.y - 6));
        if (overlapX < overlapY) b.vx = -b.vx;
        else b.vy = -b.vy;
        k.hp--;
        k.flash = 0.12;
        if (k.hp <= 0) {
          const gain = PER_HP * k.max;
          this.points += gain;
          this.resolved++;
          sfx.chord();
          this.fx.burst(k.x + BRICK_W / 2, k.y + BRICK_H / 2, this.a, 8);
          this.fx.float(k.x + BRICK_W / 2, k.y, `+${gain}`, this.a);
          if (Math.random() < DROP_CHANCE) this.drops.push({ x: k.x + BRICK_W / 2, y: k.y, kind: Math.random() < 0.5 ? "appeal" : "set" });
        } else sfx.tick();
        break;
      }
      this.bricks = this.bricks.filter((k) => k.hp > 0);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    this.fx.pre(ctx);
    // corrupted protocol scanlines
    ctx.fillStyle = withAlpha(this.a, 0.035);
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
    for (const k of this.bricks) {
      // bricks shrink as they lose hit points
      const s = 0.72 + 0.28 * (k.hp / k.max);
      const w = BRICK_W * s,
        h = BRICK_H * s;
      const x = k.x + (BRICK_W - w) / 2,
        y = k.y + (BRICK_H - h) / 2;
      ctx.fillStyle = k.flash > 0 ? "#FFFFFF" : withAlpha(this.a, 0.35 + 0.65 * (k.max / 5));
      roundRect(ctx, x, y, w, h, 4);
      ctx.fill();
      ctx.fillStyle = COLORS.bg;
      ctx.font = "700 13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(k.hp), k.x + BRICK_W / 2, k.y + BRICK_H / 2 + 1);
    }
    for (const d of this.drops) {
      ctx.strokeStyle = this.a;
      ctx.lineWidth = 2;
      roundRect(ctx, d.x - 30, d.y - 9, 60, 18, 9);
      ctx.stroke();
      ctx.fillStyle = this.a;
      ctx.font = "700 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(d.kind === "appeal" ? "APPEAL" : "SET", d.x, d.y + 1);
    }
    for (const b of this.balls) {
      b.trail.forEach((t, i) => {
        ctx.fillStyle = withAlpha(this.a, (i + 1) / 14);
        ctx.beginPath();
        ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = this.a;
    roundRect(ctx, this.px - this.pw() / 2, PADDLE_Y, this.pw(), PADDLE_H, 6);
    ctx.fill();
    if (this.balls.some((b) => b.stuck) && !this.over) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = "600 14px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("SPACE OR TAP TO LAUNCH", W / 2, PADDLE_Y - 40);
    }
    this.fx.draw(ctx);
    ctx.restore();
    ctx.textAlign = "left";
    hud(ctx, `appeal breaker  wave ${this.wave + 1}  balls ${this.lives}`, pad(this.points), this.a);
  }
}

export default function AppealBreaker(props: GameProps) {
  return <CanvasGame props={props} label="Appeal Breaker game canvas" make={(a, h) => new Breaker(a, h)} />;
}
