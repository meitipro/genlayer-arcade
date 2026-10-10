"use client";
// Node Defender: faulty blocks fall toward the chain. Slide your node and shoot
// them down. The node fires by itself, so it plays the same on a phone.
import { FX } from "@/lib/engine/fx";
import { COLORS, H, hud, pad, roundRect, W, withAlpha, type Input, type Scene } from "@/lib/engine/loop";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";
import { CanvasGame, type Hooks } from "../CanvasGame";

const MOVE = 430;
const FIRE_EVERY = 0.28;
const BULLET_V = 640;
const PER_HIT = 10;
const LIVES = 3;
const PY = H - 46;
const SHIP_W = 44;
const BLOCK = 32;
const LAND = H - 78;

type Enemy = { x: number; y: number; hp: number; max: number; v: number };
type Bullet = { x: number; y: number };

export class Defender implements Scene {
  x = W / 2;
  t = 0;
  cool = 0.2;
  spawn = 0.8;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  points = 0;
  kills = 0;
  lives = LIVES;
  invuln = 0;
  over = false;
  fx = new FX();

  constructor(
    private a: string,
    private hooks: Hooks,
  ) {}

  hurt() {
    this.lives--;
    this.invuln = 1;
    sfx.hit();
    this.fx.hit(180);
    if (this.lives <= 0) {
      this.over = true;
      this.hooks.over(this.points, { kills: this.kills, n: this.kills });
    }
  }

  update(dt: number, input: Input) {
    this.fx.update(dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.over || !this.hooks.running()) return;
    this.t += dt;

    let dir = 0;
    if (input.pressed.has("ArrowLeft") || input.pressed.has("KeyA")) dir -= 1;
    if (input.pressed.has("ArrowRight") || input.pressed.has("KeyD")) dir += 1;
    if (input.pointer.down) dir = input.pointer.x < this.x - 10 ? -1 : input.pointer.x > this.x + 10 ? 1 : 0;
    this.x = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, this.x + dir * MOVE * dt));

    this.cool -= dt;
    if (this.cool <= 0) {
      this.bullets.push({ x: this.x, y: PY - 22 });
      this.cool = FIRE_EVERY;
      sfx.tick();
    }
    for (const b of this.bullets) b.y -= BULLET_V * dt;
    this.bullets = this.bullets.filter((b) => b.y > -10);

    this.spawn -= dt;
    if (this.spawn <= 0) {
      const armored = Math.random() < Math.min(0.35, 0.08 + this.t * 0.004);
      this.enemies.push({
        x: BLOCK + Math.random() * (W - BLOCK * 2),
        y: -BLOCK,
        hp: armored ? 2 : 1,
        max: armored ? 2 : 1,
        v: Math.min(170, 70 + this.t * 1.2) * (0.85 + Math.random() * 0.3),
      });
      this.spawn = Math.max(0.5, 1.25 - this.t * 0.012);
    }
    for (const e of this.enemies) e.y += e.v * dt;

    // bullets against blocks: a bullet is spent on the first block it touches
    for (const b of this.bullets) {
      const e = this.enemies.find((q) => Math.abs(q.x - b.x) < BLOCK / 2 + 3 && Math.abs(q.y - b.y) < BLOCK / 2 + 6);
      if (!e) continue;
      b.y = -100;
      e.hp--;
      this.points += PER_HIT;
      sfx.pop();
      this.fx.burst(e.x, e.y, COLORS.danger, e.hp > 0 ? 3 : 8);
      this.fx.float(e.x, e.y - 18, `+${PER_HIT}`, this.a);
      if (e.hp <= 0) this.kills++;
    }
    this.bullets = this.bullets.filter((b) => b.y > -50);
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // a block that lands on the chain, or on the node, costs a life
    for (const e of this.enemies) {
      if (this.over) break;
      const touching = this.invuln <= 0 && Math.abs(e.x - this.x) < (BLOCK + SHIP_W) / 2 - 4 && e.y > PY - 30;
      if (e.y >= LAND || touching) {
        e.hp = 0;
        this.hurt();
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (!this.over) this.hooks.score(this.points);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    this.fx.pre(ctx);
    // the chain at the bottom
    ctx.fillStyle = withAlpha(this.a, 0.18);
    ctx.fillRect(0, LAND + BLOCK / 2, W, H - LAND);
    ctx.strokeStyle = this.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, LAND + BLOCK / 2);
    ctx.lineTo(W, LAND + BLOCK / 2);
    ctx.stroke();
    for (const e of this.enemies) {
      ctx.fillStyle = e.max === 2 ? COLORS.danger : withAlpha(COLORS.danger, 0.8);
      roundRect(ctx, e.x - BLOCK / 2, e.y - BLOCK / 2, BLOCK, BLOCK, 7);
      ctx.fill();
      if (e.max === 2) {
        ctx.strokeStyle = e.hp === 2 ? COLORS.text : COLORS.bg;
        ctx.lineWidth = 3;
        roundRect(ctx, e.x - BLOCK / 2 + 4, e.y - BLOCK / 2 + 4, BLOCK - 8, BLOCK - 8, 4);
        ctx.stroke();
      }
    }
    ctx.fillStyle = this.a;
    for (const b of this.bullets) ctx.fillRect(b.x - 2, b.y - 8, 4, 14);
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    if (!blink) {
      ctx.fillStyle = this.a;
      ctx.beginPath();
      ctx.moveTo(this.x, PY - 24);
      ctx.lineTo(this.x + SHIP_W / 2, PY + 14);
      ctx.lineTo(this.x - SHIP_W / 2, PY + 14);
      ctx.closePath();
      ctx.fill();
    }
    this.fx.draw(ctx);
    ctx.restore();
    hud(ctx, `node defender  lives ${this.lives}`, pad(this.points), this.a);
  }
}

export default function NodeDefender(props: GameProps) {
  return <CanvasGame props={props} label="Node Defender game canvas" make={(a, h) => new Defender(a, h)} />;
}
