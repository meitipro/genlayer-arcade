"use client";
// 10.2 Consensus Stack. A one-tap stacker: each block is a round; only the part
// that agrees with the block below survives.
import { FX } from "@/lib/engine/fx";
import { COLORS, dim, H, hud, pad, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

// ---- every number from section 10.2 ----
const PER_BLOCK = 10;
const PERFECT_BONUS = 25;
const PERFECT_PX = 4; // overlap within 4px
const REGROW_STREAK = 3; // three perfect drops in a row
const REGROW = 0.1; // regrow by 10%
const SPEED0 = 180; // px/s
const SPEED_STEP = 20; // every 5 blocks
const SPEED_MAX = 520;
const EASE_FROM = 20; // from block 20 the slide eases in and out
const SWING = 260; // a new block starts 260px from the aligned spot
const BLOCK_H = 28;
const BASE_W = 300;
const VIEW_TOP_BLOCKS = 5; // camera keeps the top 5 blocks in view

type Block = { x: number; w: number };
type Piece = { x: number; y: number; w: number; vy: number; life: number };

export class Stack implements Scene {
  tower: Block[] = [{ x: (W - BASE_W) / 2, w: BASE_W }];
  u = 0; // 0..1 along the swing
  dir = 1;
  cur: Block = { x: 0, w: BASE_W };
  points = 0;
  streak = 0;
  perfects = 0;
  maxStreak = 0;
  pieces: Piece[] = [];
  cam = 0;
  over = false;
  flash = 0;
  fx = new FX();

  constructor(
    private a: string,
    private hooks: Hooks,
  ) {
    this.next();
  }

  get level() {
    return this.tower.length - 1;
  }
  speed() {
    return Math.min(SPEED_MAX, SPEED0 + SPEED_STEP * Math.floor(this.level / 5));
  }
  baseY(i: number) {
    return H - 60 - (i + 1) * BLOCK_H;
  }

  next() {
    const top = this.tower[this.tower.length - 1];
    this.cur = { x: top.x, w: top.w };
    // direction alternates each block
    this.dir = this.level % 2 === 0 ? 1 : -1;
    this.u = 0;
  }

  offset(): number {
    // u runs 0..1..0; offset from aligned is -SWING..+SWING in the block's direction
    const e = this.level >= EASE_FROM ? (1 - Math.cos(Math.PI * this.u)) / 2 : this.u;
    return this.dir * (-SWING + 2 * SWING * e);
  }

  drop() {
    const top = this.tower[this.tower.length - 1];
    const x = top.x + this.offset();
    const left = Math.max(x, top.x);
    const right = Math.min(x + this.cur.w, top.x + top.w);
    const overlap = right - left;
    const y = this.baseY(this.tower.length);
    if (overlap <= 0) {
      this.pieces.push({ x, y, w: this.cur.w, vy: 0, life: 1.2 });
      this.over = true;
      sfx.fail();
      this.fx.hit(160);
      this.hooks.over(this.points, { perfects: this.perfects, maxStreak: this.maxStreak, blocks: this.level });
      return;
    }
    if (Math.abs(x - top.x) <= PERFECT_PX && this.cur.w <= top.w + 0.5) {
      // a round where every validator agreed
      this.streak++;
      this.perfects++;
      this.maxStreak = Math.max(this.maxStreak, this.streak);
      let w = top.w;
      if (this.streak % REGROW_STREAK === 0) w = Math.min(BASE_W, w * (1 + REGROW));
      const nx = top.x - (w - top.w) / 2;
      this.tower.push({ x: nx, w });
      this.points += PER_BLOCK + PERFECT_BONUS;
      sfx.perfect(this.streak);
      this.flash = 0.5;
      this.fx.float(W / 2, y - 18, `FINALIZED +${PERFECT_BONUS}`, this.a);
      this.fx.burst(nx + w / 2, y, this.a, 8);
    } else {
      this.streak = 0;
      this.tower.push({ x: left, w: overlap });
      // the part that disagrees falls away
      const cutX = x < top.x ? x : right;
      const cutW = this.cur.w - overlap;
      if (cutW > 0) this.pieces.push({ x: cutX, y, w: cutW, vy: 0, life: 1 });
      this.points += PER_BLOCK;
      sfx.thud();
    }
    this.next();
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    for (const p of this.pieces) {
      p.vy += 1800 * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.pieces = this.pieces.filter((p) => p.life > 0);
    // camera eases up to keep the top blocks in view
    const want = Math.max(0, (this.tower.length - VIEW_TOP_BLOCKS) * BLOCK_H - 120);
    this.cam += (want - this.cam) * Math.min(1, dt * 4);
    if (this.over || !this.hooks.running()) return;

    const travel = (2 * SWING) / this.speed(); // seconds for one pass
    this.u += dt / travel;
    if (this.u >= 1) {
      this.u = 1;
      this.dir = -this.dir; // bounce: come back across
      this.u = 0;
    }
    if (input.justPressed.has("Space") || input.justPressed.has("Enter") || input.justPressed.has("ArrowDown") || input.pointer.tapped) this.drop();
    this.hooks.score(this.points);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    // the vault: faint server racks
    ctx.strokeStyle = withAlpha(this.a, 0.07);
    for (let x = 40; x < W; x += 90) {
      ctx.strokeRect(x, 40, 60, H - 80);
    }
    if (this.flash > 0) {
      ctx.fillStyle = withAlpha(this.a, this.flash * 0.15);
      ctx.fillRect(0, 0, W, H);
    }
    this.fx.pre(ctx);
    ctx.translate(0, this.cam);
    const n = this.tower.length;
    this.tower.forEach((b, i) => {
      // colour steps from dim to full accent as the tower rises
      ctx.fillStyle = dim(this.a, Math.min(1, 0.25 + i / 25));
      ctx.fillRect(b.x, this.baseY(i), b.w, BLOCK_H - 2);
    });
    if (!this.over) {
      const top = this.tower[n - 1];
      ctx.fillStyle = this.a;
      ctx.fillRect(top.x + this.offset(), this.baseY(n), this.cur.w, BLOCK_H - 2);
    }
    for (const p of this.pieces) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = this.over ? COLORS.danger : dim(this.a, 0.6);
      ctx.fillRect(p.x, p.y, p.w, BLOCK_H - 2);
    }
    ctx.globalAlpha = 1;
    this.fx.draw(ctx);
    ctx.restore();
    hud(ctx, `consensus stack  round ${this.level}${this.streak > 1 ? `  streak ${this.streak}` : ""}`, pad(this.points), this.a);
  }
}

export default function ConsensusStack(props: GameProps) {
  return <CanvasGame props={props} label="Consensus Stack game canvas" make={(a, h) => new Stack(a, h)} />;
}
