"use client";
// Whack-a-Node: faulty nodes pop out of a 3 x 3 wall. Slash them before they
// hide and leave the honest ones alone. 45 seconds.
import { FX } from "@/lib/engine/fx";
import { COLORS, H, hud, pad, roundRect, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

const ROUND_S = 45;
const HIT = 10;
const MISTAKE = 20;
const SPAWN0 = 0.8;
const SPAWN_MIN = 0.4;
const LIFE0 = 1.0;
const LIFE_MIN = 0.55;
const FAULTY_SHARE = 0.7;
const SIZE = 92;
const GAP = 22;
const X0 = (W - (3 * SIZE + 2 * GAP)) / 2;
const Y0 = 66;

const KEYS: Record<string, number> = {
  Numpad7: 0, Numpad8: 1, Numpad9: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad1: 6, Numpad2: 7, Numpad3: 8,
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8,
  KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, KeyZ: 6, KeyX: 7, KeyC: 8,
};

type Hole = { kind: "empty" | "faulty" | "honest"; age: number; life: number; flash: number };

export class Whack implements Scene {
  t = 0;
  holes: Hole[] = Array.from({ length: 9 }, () => ({ kind: "empty", age: 0, life: 0, flash: 0 }));
  wait = 0.6;
  points = 0;
  slashed = 0;
  mistakes = 0;
  over = false;
  redFlash = 0;
  fx = new FX();

  constructor(
    private a: string,
    private hooks: Hooks,
  ) {}

  centre(i: number) {
    return { x: X0 + (i % 3) * (SIZE + GAP) + SIZE / 2, y: Y0 + Math.floor(i / 3) * (SIZE + GAP) + SIZE / 2 + 20 };
  }

  tap(i: number) {
    const h = this.holes[i];
    const c = this.centre(i);
    if (h.kind === "faulty") {
      this.points += HIT;
      this.slashed++;
      h.kind = "empty";
      h.flash = 0.18;
      sfx.pop();
      this.fx.burst(c.x, c.y, COLORS.danger, 8);
      this.fx.float(c.x, c.y - SIZE / 2, `+${HIT}`, this.a);
    } else if (h.kind === "honest") {
      this.points = Math.max(0, this.points - MISTAKE);
      this.mistakes++;
      h.kind = "empty";
      this.redFlash = 0.22;
      this.fx.hit(140);
      sfx.buzz();
      this.fx.float(c.x, c.y - SIZE / 2, `HONEST -${MISTAKE}`, COLORS.danger);
    } else sfx.click();
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    this.redFlash = Math.max(0, this.redFlash - dt);
    for (const h of this.holes) h.flash = Math.max(0, h.flash - dt);
    if (this.over || !this.hooks.running()) return;
    this.t += dt;
    if (this.t >= ROUND_S) {
      this.over = true;
      this.hooks.over(this.points, { slashed: this.slashed, mistakes: this.mistakes, n: this.slashed });
      return;
    }
    if (input.pointer.tapped) {
      for (let i = 0; i < 9; i++) {
        const c = this.centre(i);
        if (Math.abs(input.pointer.x - c.x) < SIZE / 2 + 8 && Math.abs(input.pointer.y - c.y) < SIZE / 2 + 8) this.tap(i);
      }
    }
    for (const code of input.justPressed) if (code in KEYS) this.tap(KEYS[code]);

    for (const h of this.holes) {
      if (h.kind === "empty") continue;
      h.age += dt;
      if (h.age >= h.life) h.kind = "empty";
    }
    this.wait -= dt;
    if (this.wait <= 0) {
      const free = this.holes.map((h, i) => (h.kind === "empty" ? i : -1)).filter((i) => i >= 0);
      if (free.length) {
        const i = free[Math.floor(Math.random() * free.length)];
        const honestShare = 1 - FAULTY_SHARE;
        this.holes[i] = {
          kind: Math.random() < honestShare ? "honest" : "faulty",
          age: 0,
          life: Math.max(LIFE_MIN, LIFE0 - this.t * 0.01),
          flash: 0,
        };
      }
      this.wait = Math.max(SPAWN_MIN, SPAWN0 - this.t * 0.01);
    }
    this.hooks.score(this.points);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (this.redFlash > 0) {
      ctx.fillStyle = withAlpha(COLORS.danger, this.redFlash * 0.5);
      ctx.fillRect(0, 0, W, H);
    }
    this.fx.pre(ctx);
    this.holes.forEach((h, i) => {
      const c = this.centre(i);
      // the hole
      ctx.fillStyle = COLORS.raised;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + SIZE / 2 - 10, SIZE / 2, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      if (h.kind !== "empty") {
        // pops up over 0.12 s, drops back during the last 0.12 s
        const rise = Math.min(1, h.age / 0.12, Math.max(0, (h.life - h.age) / 0.12));
        const s = SIZE * 0.82;
        const top = c.y + SIZE / 2 - 10 - s * rise;
        ctx.fillStyle = h.kind === "faulty" ? COLORS.danger : this.a;
        roundRect(ctx, c.x - s / 2, top, s, s, 16);
        ctx.fill();
        ctx.fillStyle = COLORS.bg;
        ctx.font = "700 13px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(h.kind === "faulty" ? "FAULTY" : "HONEST", c.x, top + s / 2);
      } else if (h.flash > 0) {
        ctx.strokeStyle = COLORS.danger;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(c.x - 22, c.y - 10);
        ctx.lineTo(c.x + 22, c.y + 18);
        ctx.stroke();
      }
    });
    ctx.textAlign = "left";
    // clock bar
    const bw = 3 * SIZE + 2 * GAP;
    ctx.fillStyle = COLORS.raised;
    ctx.fillRect(X0, H - 40, bw, 8);
    ctx.fillStyle = this.a;
    ctx.fillRect(X0, H - 40, bw * Math.max(0, 1 - this.t / ROUND_S), 8);
    this.fx.draw(ctx);
    ctx.restore();
    hud(ctx, `whack-a-node  ${Math.ceil(ROUND_S - this.t)}s`, pad(this.points), this.a);
  }
}

export default function WhackANode(props: GameProps) {
  return <CanvasGame props={props} label="Whack-a-Node game canvas" make={(a, h) => new Whack(a, h)} />;
}
