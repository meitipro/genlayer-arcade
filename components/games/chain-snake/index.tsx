"use client";
// 10.5 Chain Snake. Classic snake rebuilt around finality: eat transactions,
// and every five turn into a finalized block that hardens your tail.
import { FX } from "@/lib/engine/fx";
import { COLORS, H, hud, pad, roundRect, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

// ---- every number from section 10.5 ----
const COLS = 24,
  ROWS = 15;
const TICK0 = 0.14; // s
const TICK_STEP = 0.004; // minus 4 ms per finalized block
const TICK_MIN = 0.07;
const TX = 10;
const FINALIZE_EVERY = 5;
const FINALIZE_BONUS = 50;
const FAULT_EVERY = 20; // s
const FAULT_FOR = 8; // s
const QUEUE = 2; // input queue of 2 so quick turns never get lost
const MIN_SPAWN_DIST = 3;

const CW = W / COLS,
  CH = H / ROWS;
type P = { x: number; y: number };

const DIRS: Record<string, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const KEYMAP: Record<string, keyof typeof DIRS> = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};

export class Snake implements Scene {
  // positions, head first
  body: P[] = [
    { x: 8, y: 7 },
    { x: 7, y: 7 },
    { x: 6, y: 7 },
  ];
  // finality per body index (head = 0). Moving shifts positions, not indices;
  // growing appends a new index at the tail, the newest segment.
  fin: boolean[] = [false, false, false];
  dir: P = DIRS.right;
  queue: P[] = [];
  acc = 0;
  t = 0;
  food: P;
  fault: (P & { left: number }) | null = null;
  nextFault = FAULT_EVERY;
  eaten = 0;
  blocks = 0;
  points = 0;
  over = false;
  fx = new FX();

  constructor(
    private a: string,
    private hooks: Hooks,
  ) {
    this.food = this.place();
  }

  tick() {
    return Math.max(TICK_MIN, TICK0 - TICK_STEP * this.blocks);
  }

  occupied(p: P) {
    return this.body.some((s) => s.x === p.x && s.y === p.y) || (this.fault && this.fault.x === p.x && this.fault.y === p.y);
  }

  place(): P {
    const head = this.body[0];
    for (let tries = 0; tries < 500; tries++) {
      const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      if (this.occupied(p)) continue;
      if (Math.abs(p.x - head.x) + Math.abs(p.y - head.y) < MIN_SPAWN_DIST) continue;
      if (this.food && p.x === this.food.x && p.y === this.food.y) continue;
      return p;
    }
    return { x: 0, y: 0 };
  }

  steer(d: P) {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (d.x === -last.x && d.y === -last.y) return; // no reversing into yourself
    if (d.x === last.x && d.y === last.y) return;
    if (this.queue.length < QUEUE) this.queue.push(d);
  }

  die() {
    this.over = true;
    sfx.crash();
    this.fx.hit(160);
    const h = this.body[0];
    this.fx.burst(h.x * CW + CW / 2, h.y * CH + CH / 2, COLORS.danger, 12);
    this.hooks.over(this.points, { blocks: this.blocks, eaten: this.eaten });
  }

  step() {
    if (this.queue.length) this.dir = this.queue.shift()!;
    const h = this.body[0];
    const n = { x: h.x + this.dir.x, y: h.y + this.dir.y };
    // hitting a wall or yourself is a fork
    if (n.x < 0 || n.y < 0 || n.x >= COLS || n.y >= ROWS) return this.die();
    const willGrow = n.x === this.food.x && n.y === this.food.y;
    const bodyToCheck = willGrow ? this.body : this.body.slice(0, -1);
    if (bodyToCheck.some((s) => s.x === n.x && s.y === n.y)) return this.die();
    if (this.fault && n.x === this.fault.x && n.y === this.fault.y) return this.die();

    this.body.unshift(n);
    if (willGrow) {
      // the tail stays where it was: the body grows by one
      this.fin.push(false);
      this.eaten++;
      this.points += TX;
      sfx.pop();
      this.fx.burst(n.x * CW + CW / 2, n.y * CH + CH / 2, this.a, 6);
      this.fx.float(n.x * CW + CW / 2, n.y * CH, `+${TX}`, this.a);
      if (this.eaten % FINALIZE_EVERY === 0) {
        // every 5th transaction finalizes the newest 5 segments (the tail end)
        let marked = 0;
        for (let i = this.fin.length - 1; i >= 0 && marked < FINALIZE_EVERY; i--) {
          if (!this.fin[i]) {
            this.fin[i] = true;
            marked++;
          }
        }
        this.blocks++;
        this.points += FINALIZE_BONUS;
        sfx.arpeggio();
        this.fx.float(n.x * CW + CW / 2, n.y * CH - 22, `FINALIZED +${FINALIZE_BONUS}`, this.a);
      }
      this.food = this.place();
    } else {
      this.body.pop();
    }
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    if (this.over || !this.hooks.running()) return;
    for (const code of input.justPressed) if (code in KEYMAP) this.steer(DIRS[KEYMAP[code]]);
    if (input.swipe) this.steer(DIRS[input.swipe]);
    this.t += dt;

    // a faulty block appears every 20 s for 8 s
    if (this.fault) {
      this.fault.left -= dt;
      if (this.fault.left <= 0) this.fault = null;
    } else if (this.t >= this.nextFault) {
      this.fault = { ...this.place(), left: FAULT_FOR };
      this.nextFault += FAULT_EVERY;
    }

    this.acc += dt;
    while (this.acc >= this.tick() && !this.over) {
      this.acc -= this.tick();
      this.step();
    }
    this.hooks.score(this.points);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    this.fx.pre(ctx);
    // lime terminal grid
    ctx.strokeStyle = withAlpha(this.a, 0.06);
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CW, 0);
      ctx.lineTo(x * CW, H);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CH);
      ctx.lineTo(W, y * CH);
      ctx.stroke();
    }
    // transaction: a ring
    ctx.strokeStyle = this.a;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.food.x * CW + CW / 2, this.food.y * CH + CH / 2, CW * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    if (this.fault) {
      const blink = this.fault.left < 2 && Math.floor(this.fault.left * 6) % 2 === 0;
      if (!blink) {
        ctx.fillStyle = COLORS.danger;
        roundRect(ctx, this.fault.x * CW + 4, this.fault.y * CH + 4, CW - 8, CH - 8, 4);
        ctx.fill();
      }
    }
    this.body.forEach((s, i) => {
      const x = s.x * CW + 3,
        y = s.y * CH + 3,
        w = CW - 6,
        h = CH - 6;
      if (i === 0) {
        ctx.shadowColor = this.a;
        ctx.shadowBlur = 14;
      }
      if (this.fin[i]) {
        // finalized segments render outlined with lower fill
        ctx.fillStyle = withAlpha(this.a, 0.25);
        roundRect(ctx, x, y, w, h, 5);
        ctx.fill();
        ctx.strokeStyle = this.a;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = this.over ? COLORS.muted : this.a;
        roundRect(ctx, x, y, w, h, 5);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    });
    this.fx.draw(ctx);
    ctx.restore();
    hud(ctx, `chain snake  block ${this.blocks}`, pad(this.points), this.a);
  }
}

export default function ChainSnake(props: GameProps) {
  return <CanvasGame props={props} label="Chain Snake game canvas" make={(a, h) => new Snake(a, h)} />;
}
