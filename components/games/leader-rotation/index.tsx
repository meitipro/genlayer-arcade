"use client";
// 10.3 Leader Rotation. A 60-second reflex game on a grid of nine validator
// nodes. Tap the leader before the window closes; tap a faulty node and you get slashed.
import { FX } from "@/lib/engine/fx";
import { COLORS, H, hud, pad, roundRect, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

// ---- every number from section 10.3 ----
const GAME_S = 60;
const PER_HIT = 10; // x combo
const COMBO_MAX = 8;
const SLASH = 30;
const WINDOW0 = 1.1; // s
const WINDOW_STEP = 0.025; // shrinks 25 ms per hit
const WINDOW_MIN = 0.38;
const TWO_LEADERS_AT = 20; // s
const MORE_FAULTS_AT = 40; // s
const NEXT_DELAY = 0.2; // a new leader appears 200 ms after a hit or rotation

const SIZE = 92,
  GAP = 22;
const X0 = (W - (3 * SIZE + 2 * GAP)) / 2,
  Y0 = 62;

// keyboard: numpad laid out as on the keypad, digits in reading order, and Q W E / A S D / Z X C
const KEYS: Record<string, number> = {
  Numpad7: 0, Numpad8: 1, Numpad9: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad1: 6, Numpad2: 7, Numpad3: 8,
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8,
  KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, KeyZ: 6, KeyX: 7, KeyC: 8,
};

type Node = { state: "idle" | "leader" | "faulty"; left: number; total: number; pop: number };

export class Rotation implements Scene {
  t = 0;
  nodes: Node[] = Array.from({ length: 9 }, () => ({ state: "idle", left: 0, total: 0, pop: 0 }));
  window = WINDOW0;
  combo = 0;
  maxCombo = 0;
  points = 0;
  led = 0;
  slashes = 0;
  wait = 0.6;
  faultWait = 3;
  redFlash = 0;
  over = false;
  fx = new FX();

  constructor(
    private a: string,
    private hooks: Hooks,
  ) {}

  center(i: number) {
    return { x: X0 + (i % 3) * (SIZE + GAP) + SIZE / 2, y: Y0 + Math.floor(i / 3) * (SIZE + GAP) + SIZE / 2 };
  }
  leaders() {
    return this.nodes.filter((n) => n.state === "leader").length;
  }
  free(): number | null {
    const idle = this.nodes.map((n, i) => (n.state === "idle" && n.pop <= 0 ? i : -1)).filter((i) => i >= 0);
    return idle.length ? idle[Math.floor(Math.random() * idle.length)] : null;
  }
  spawnLeader() {
    const i = this.free();
    if (i === null) return;
    this.nodes[i] = { state: "leader", left: this.window, total: this.window, pop: 0 };
  }

  tap(i: number) {
    const n = this.nodes[i];
    const c = this.center(i);
    if (n.state === "leader") {
      this.combo = Math.min(COMBO_MAX, this.combo + 1);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const gain = PER_HIT * this.combo;
      this.points += gain;
      this.led++;
      this.window = Math.max(WINDOW_MIN, this.window - WINDOW_STEP);
      n.state = "idle";
      n.pop = 0.18;
      sfx.combo(this.combo);
      this.fx.burst(c.x, c.y, this.a, 6);
      this.fx.float(c.x, c.y - SIZE / 2, `+${gain}`, this.a);
      if (this.leaders() === 0) this.wait = NEXT_DELAY;
    } else if (n.state === "faulty") {
      this.points = Math.max(0, this.points - SLASH);
      this.combo = 0;
      this.slashes++;
      n.state = "idle";
      this.redFlash = 0.25;
      this.fx.hit(150);
      sfx.buzz();
      this.fx.float(c.x, c.y - SIZE / 2, `SLASHED -${SLASH}`, COLORS.danger);
    }
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    this.redFlash = Math.max(0, this.redFlash - dt);
    for (const n of this.nodes) n.pop = Math.max(0, n.pop - dt);
    if (this.over || !this.hooks.running()) return;
    this.t += dt;
    if (this.t >= GAME_S) {
      this.over = true;
      this.hooks.over(this.points, { maxCombo: this.maxCombo, led: this.led, slashes: this.slashes, n: this.led });
      return;
    }

    // input
    if (input.pointer.tapped) {
      for (let i = 0; i < 9; i++) {
        const c = this.center(i);
        if (Math.abs(input.pointer.x - c.x) < SIZE / 2 + 6 && Math.abs(input.pointer.y - c.y) < SIZE / 2 + 6) this.tap(i);
      }
    }
    for (const code of input.justPressed) if (code in KEYS) this.tap(KEYS[code]);

    // windows
    for (const n of this.nodes) {
      if (n.state === "idle") continue;
      n.left -= dt;
      if (n.left <= 0) {
        if (n.state === "leader") {
          // rotation: the network moves on to a new leader, combo resets, no penalty
          this.combo = 0;
          sfx.click();
          if (this.leaders() === 1) this.wait = NEXT_DELAY;
        }
        n.state = "idle";
      }
    }

    // new leaders
    this.wait -= dt;
    const cap = this.t >= TWO_LEADERS_AT ? 2 : 1;
    if (this.wait <= 0 && this.leaders() < cap) {
      this.spawnLeader();
      this.wait = cap === 2 && this.leaders() < 2 ? 0.35 + Math.random() * 0.5 : 0.1;
    }

    // faulty nodes, more often from 40 s
    this.faultWait -= dt;
    if (this.faultWait <= 0) {
      const i = this.free();
      if (i !== null) this.nodes[i] = { state: "faulty", left: 1.3, total: 1.3, pop: 0 };
      this.faultWait = this.t >= MORE_FAULTS_AT ? 0.7 + Math.random() * 0.8 : 1.8 + Math.random() * 1.6;
    }
    this.hooks.score(this.points);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    if (this.redFlash > 0) {
      ctx.fillStyle = withAlpha(COLORS.danger, this.redFlash * 0.6);
      ctx.fillRect(0, 0, W, H);
    }
    this.fx.pre(ctx);
    this.nodes.forEach((n, i) => {
      const c = this.center(i);
      const grow = n.pop > 0 ? 1 + n.pop * 0.8 : 1;
      const s = SIZE * grow;
      ctx.fillStyle = n.state === "leader" ? this.a : n.state === "faulty" ? COLORS.danger : COLORS.raised;
      roundRect(ctx, c.x - s / 2, c.y - s / 2, s, s, 18);
      ctx.fill();
      if (n.state === "leader") {
        // leader ring pulses outwards
        const k = 1 - n.left / n.total;
        ctx.strokeStyle = withAlpha(this.a, 1 - k);
        ctx.lineWidth = 3;
        const r = SIZE / 2 + 6 + k * 22;
        roundRect(ctx, c.x - r, c.y - r, r * 2, r * 2, 22);
        ctx.stroke();
        ctx.fillStyle = COLORS.bg;
        ctx.font = "700 16px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("LEAD", c.x, c.y);
      } else if (n.state === "faulty") {
        ctx.fillStyle = COLORS.bg;
        ctx.font = "700 14px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("FAULTY", c.x, c.y);
      }
    });
    ctx.textAlign = "left";
    // timer bar under the grid drains in accent
    const bw = 3 * SIZE + 2 * GAP;
    const left = Math.max(0, 1 - this.t / GAME_S);
    ctx.fillStyle = COLORS.raised;
    ctx.fillRect(X0, H - 46, bw, 8);
    ctx.fillStyle = this.a;
    ctx.fillRect(X0, H - 46, bw * left, 8);
    this.fx.draw(ctx);
    ctx.restore();
    hud(ctx, `leader rotation  ${this.combo > 1 ? `combo x${this.combo}` : `${Math.ceil(GAME_S - this.t)}s`}`, pad(this.points), this.a);
  }
}

export default function LeaderRotation(props: GameProps) {
  return <CanvasGame props={props} label="Leader Rotation game canvas" make={(a, h) => new Rotation(a, h)} />;
}
