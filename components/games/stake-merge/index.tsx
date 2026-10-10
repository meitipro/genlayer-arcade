"use client";
// Stake Merge: slide the stakes; two equal stakes merge into one twice as big.
// Two minutes, 4 x 4.
import { FX } from "@/lib/engine/fx";
import { COLORS, H, hud, pad, roundRect, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

const N = 4;
const ROUND_S = 120;
const MOVE_COOLDOWN = 0.12;
const TILE = 96;
const TGAP = 10;
const BOARD = N * TILE + (N + 1) * TGAP;
const BX = (W - BOARD) / 2;
const BY = 62;

export type Dir = "left" | "right" | "up" | "down";

/** Slides one line toward index 0 and merges equal neighbours once. Returns the new line and the points it made. */
export function slideLine(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++;
    } else out.push(tiles[i]);
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained };
}

/** One move on a 4 x 4 board stored row by row. */
export function slideBoard(grid: number[], dir: Dir): { grid: number[]; gained: number; moved: boolean } {
  const next = grid.slice();
  let gained = 0;
  for (let k = 0; k < N; k++) {
    const idx: number[] = [];
    for (let j = 0; j < N; j++) {
      idx.push(dir === "left" ? k * N + j : dir === "right" ? k * N + (N - 1 - j) : dir === "up" ? j * N + k : (N - 1 - j) * N + k);
    }
    const r = slideLine(idx.map((i) => grid[i]));
    gained += r.gained;
    idx.forEach((i, j) => (next[i] = r.line[j]));
  }
  return { grid: next, gained, moved: next.some((v, i) => v !== grid[i]) };
}

export function canMove(grid: number[]): boolean {
  return (["left", "right", "up", "down"] as Dir[]).some((d) => slideBoard(grid, d).moved);
}

const KEYS: Record<string, Dir> = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
};

export class Merge implements Scene {
  grid: number[] = new Array(N * N).fill(0);
  t = 0;
  cool = 0;
  points = 0;
  moves = 0;
  over = false;
  pop: Record<number, number> = {};
  fx = new FX();

  constructor(
    private a: string,
    private hooks: Hooks,
  ) {
    this.spawn();
    this.spawn();
  }

  get best() {
    return Math.max(...this.grid);
  }

  spawn() {
    const free = this.grid.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    if (!free.length) return;
    const i = free[Math.floor(Math.random() * free.length)];
    this.grid[i] = Math.random() < 0.9 ? 2 : 4;
    this.pop[i] = 0.15;
  }

  move(dir: Dir) {
    if (this.over || this.cool > 0) return false;
    const r = slideBoard(this.grid, dir);
    if (!r.moved) {
      sfx.mismatch();
      return false;
    }
    this.grid = r.grid;
    this.points += r.gained;
    this.moves++;
    this.cool = MOVE_COOLDOWN;
    if (r.gained) {
      sfx.match();
      this.fx.float(W / 2, BY - 14, `+${r.gained}`, this.a);
    } else sfx.click();
    this.spawn();
    if (!canMove(this.grid)) this.finish();
    return true;
  }

  finish() {
    if (this.over) return;
    this.over = true;
    sfx.fail();
    this.hooks.over(this.points, { best: this.best, moves: this.moves, n: this.best });
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    for (const k of Object.keys(this.pop)) this.pop[+k] = Math.max(0, this.pop[+k] - dt);
    this.cool = Math.max(0, this.cool - dt);
    if (this.over || !this.hooks.running()) return;
    this.t += dt;
    if (this.t >= ROUND_S) return this.finish();
    let dir: Dir | null = input.swipe;
    for (const code of input.justPressed) if (code in KEYS) dir = KEYS[code];
    if (dir) this.move(dir);
    this.hooks.score(this.points);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.surface;
    roundRect(ctx, BX, BY, BOARD, BOARD, 16);
    ctx.fill();
    for (let i = 0; i < N * N; i++) {
      const x = BX + TGAP + (i % N) * (TILE + TGAP);
      const y = BY + TGAP + Math.floor(i / N) * (TILE + TGAP);
      const v = this.grid[i];
      const s = 1 + (this.pop[i] ?? 0) * 1.2;
      ctx.fillStyle = v === 0 ? COLORS.raised : withAlpha(this.a, Math.min(1, 0.18 + Math.log2(v) * 0.075));
      roundRect(ctx, x - ((s - 1) * TILE) / 2, y - ((s - 1) * TILE) / 2, TILE * s, TILE * s, 12);
      ctx.fill();
      if (v) {
        ctx.fillStyle = v >= 8 ? COLORS.bg : COLORS.text;
        ctx.font = `700 ${v >= 1000 ? 26 : v >= 100 ? 32 : 40}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(v), x + TILE / 2, y + TILE / 2 + 2);
      }
    }
    ctx.textAlign = "left";
    this.fx.draw(ctx);
    ctx.restore();
    hud(ctx, `stake merge  ${Math.max(0, Math.ceil(ROUND_S - this.t))}s  best ${this.best}`, pad(this.points), this.a);
  }
}

export default function StakeMerge(props: GameProps) {
  return <CanvasGame props={props} label="Stake Merge game canvas" make={(a, h) => new Merge(a, h)} />;
}
