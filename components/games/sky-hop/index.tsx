"use client";
// Sky Hop: a 2D platformer. Your node bounces by itself up a tower of blocks;
// you steer. Votes are worth points, red blocks crumble after one bounce,
// springs launch you higher, and the screen wraps left to right.
import { FX } from "@/lib/engine/fx";
import { COLORS, diamond, H, hud, pad, roundRect, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

const GRAVITY = 1700;
const JUMP = 760; // apex 170 px
const SPRING = 1150; // apex 389 px
const MOVE = 340;
const SIZE = 30;
const PW = 88;
const PH = 14;
const GAP_MIN = 62;
const GAP_MAX = 118; // always inside the 170 px a normal bounce reaches
const VOTE = 5;
const PX_PER_POINT = 10;
const CAM_LINE = H * 0.42;
const MAX_STEP = 200; // one bounce lasts 0.89 s and the node steers 340 px/s: 303 px

type Plat = { x: number; y: number; kind: "solid" | "moving" | "crumble"; dir: number; spring: boolean; vote: boolean; gone: boolean };

export class Hop implements Scene {
  x = W / 2;
  y = H - 100;
  vy = -JUMP;
  prevY = H - 100;
  camY = 0; // world y of the top of the screen
  startY = H - 100;
  best = H - 100; // smallest world y reached
  votes = 0;
  points = 0;
  plats: Plat[] = [];
  over = false;
  squash = 0;
  fx = new FX();
  private seed: number;

  /** seed: a fixed one makes a tower repeatable (tests); the game passes none. */
  constructor(
    private a: string,
    private hooks: Hooks,
    seed?: number,
  ) {
    this.seed = seed ?? ((Math.random() * 2 ** 31) | 1);
    // the first block crumbles after one bounce, so standing still is not an option
    this.plats.push({ x: W / 2 - PW / 2, y: H - 70, kind: "crumble", dir: 0, spring: false, vote: false, gone: false });
    this.fill();
  }

  private rand() {
    // a small linear congruential generator (Numerical Recipes constants)
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Builds platforms upward until there are some above the top of the screen. */
  fill() {
    let top = this.plats.reduce((m, p) => Math.min(m, p.y), Infinity);
    let run = 0; // consecutive non-solid platforms
    while (top > this.camY - 160) {
      const climbed = Math.max(0, (this.startY - top) / 1000);
      const gap = GAP_MIN + (GAP_MAX - GAP_MIN) * Math.min(1, 0.35 + climbed * 0.25) * this.rand();
      top -= Math.max(GAP_MIN, Math.min(GAP_MAX, gap));
      let kind: Plat["kind"] = "solid";
      const r = this.rand();
      if (run < 2) {
        if (r < 0.14 + Math.min(0.12, climbed * 0.1)) kind = "crumble";
        else if (r < 0.34 + Math.min(0.12, climbed * 0.1)) kind = "moving";
      }
      run = kind === "solid" ? 0 : run + 1;
      // the next block is never farther sideways than one bounce can carry the node
      const prev = this.plats.reduce((m, q) => (q.y < m.y ? q : m), this.plats[0]);
      const nx = Math.max(0, Math.min(W - PW, prev.x + (this.rand() * 2 - 1) * MAX_STEP));
      this.plats.push({
        x: nx,
        y: top,
        kind,
        dir: kind === "moving" ? (this.rand() < 0.5 ? -1 : 1) : 0,
        spring: kind === "solid" && this.rand() < 0.06,
        vote: this.rand() < 0.28,
        gone: false,
      });
    }
  }

  get height() {
    return Math.max(0, Math.floor((this.startY - this.best) / PX_PER_POINT));
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    this.squash = Math.max(0, this.squash - dt);
    if (this.over || !this.hooks.running()) return;

    // steering: keys, or toward the finger / pointer while it is down
    let dir = 0;
    if (input.pressed.has("ArrowLeft") || input.pressed.has("KeyA")) dir -= 1;
    if (input.pressed.has("ArrowRight") || input.pressed.has("KeyD")) dir += 1;
    if (input.pointer.down) dir = input.pointer.x < this.x - 12 ? -1 : input.pointer.x > this.x + 12 ? 1 : 0;
    this.x += dir * MOVE * dt;
    if (this.x < -SIZE / 2) this.x += W;
    if (this.x > W - SIZE / 2) this.x -= W;

    for (const p of this.plats) {
      if (p.kind !== "moving" || p.gone) continue;
      p.x += p.dir * 90 * dt;
      if (p.x < 0) {
        p.x = 0;
        p.dir = 1;
      }
      if (p.x > W - PW) {
        p.x = W - PW;
        p.dir = -1;
      }
    }

    this.prevY = this.y;
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;

    if (this.vy > 0) {
      const feetBefore = this.prevY + SIZE;
      const feet = this.y + SIZE;
      for (const p of this.plats) {
        if (p.gone) continue;
        if (feetBefore <= p.y + 2 && feet >= p.y) {
          const cx = this.x + SIZE / 2;
          if (cx >= p.x - 8 && cx <= p.x + PW + 8) {
            this.y = p.y - SIZE;
            this.vy = p.spring ? -SPRING : -JUMP;
            this.squash = 0.12;
            if (p.spring) {
              sfx.chord();
              this.fx.burst(cx, p.y, this.a, 8);
            } else sfx.jump();
            if (p.kind === "crumble") {
              p.gone = true;
              sfx.tick();
              this.fx.burst(p.x + PW / 2, p.y, COLORS.danger, 6);
            }
            break;
          }
        }
      }
    }

    // votes
    for (const p of this.plats) {
      if (!p.vote || p.gone) continue;
      const vx = p.x + PW / 2;
      const vy = p.y - 34;
      if (Math.abs(this.x + SIZE / 2 - vx) < 22 && Math.abs(this.y + SIZE / 2 - vy) < 24) {
        p.vote = false;
        this.votes++;
        sfx.pickup();
        this.fx.burst(vx, vy, this.a, 6);
        this.fx.float(vx, vy - 14, `+${VOTE}`, this.a);
      }
    }

    this.best = Math.min(this.best, this.y);
    if (this.y < this.camY + CAM_LINE) this.camY = this.y - CAM_LINE;
    this.fill();
    this.plats = this.plats.filter((p) => p.y < this.camY + H + 80 && !p.gone);
    this.points = this.height + this.votes * VOTE;

    if (this.y - this.camY > H + 40) {
      this.over = true;
      sfx.fail();
      this.hooks.over(this.points, { height: this.height, votes: this.votes, n: this.height });
      return;
    }
    this.hooks.score(this.points);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    // skyline: faint block towers that drift with the camera
    ctx.fillStyle = withAlpha(this.a, 0.05);
    for (let i = 0; i < 9; i++) {
      const h = 110 + ((i * 53) % 150);
      ctx.fillRect(i * 96 + 10, H - h + ((-this.camY * 0.08) % 40), 60, h);
    }
    ctx.translate(0, -this.camY);
    for (const p of this.plats) {
      if (p.gone) continue;
      ctx.fillStyle = p.kind === "crumble" ? COLORS.danger : p.kind === "moving" ? withAlpha(this.a, 0.55) : this.a;
      roundRect(ctx, p.x, p.y, PW, PH, 6);
      ctx.fill();
      if (p.spring) {
        ctx.strokeStyle = COLORS.text;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x + PW / 2 - 10, p.y);
        ctx.lineTo(p.x + PW / 2 - 4, p.y - 6);
        ctx.lineTo(p.x + PW / 2 + 4, p.y - 2);
        ctx.lineTo(p.x + PW / 2 + 10, p.y - 8);
        ctx.stroke();
      }
      if (p.vote) diamond(ctx, p.x + PW / 2, p.y - 34, 9, this.a);
    }
    const sq = this.squash > 0 ? 1 - this.squash * 1.6 : 1;
    const w = SIZE * (2 - sq),
      h = SIZE * sq;
    ctx.fillStyle = this.over ? COLORS.muted : COLORS.text;
    for (const ox of [0, -W, W]) {
      roundRect(ctx, this.x + ox + (SIZE - w) / 2, this.y + (SIZE - h), w, h, 8);
      ctx.fill();
    }
    this.fx.draw(ctx);
    ctx.restore();
    hud(ctx, `sky hop  ${this.height} m  votes ${this.votes}`, pad(this.points), this.a);
  }
}

export default function SkyHop(props: GameProps) {
  return <CanvasGame props={props} label="Sky Hop game canvas" make={(a, h) => new Hop(a, h)} />;
}
