// lib/engine/fx.ts particles, shake, floating text: one tiny module for juice (section 9).
import { reducedMotion } from "./loop";

export class FX {
  parts: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
  texts: { x: number; y: number; t: string; life: number; c: string }[] = [];
  shake = 0;
  private calm = reducedMotion();

  burst(x: number, y: number, c: string, n = 6) {
    if (this.calm) n = Math.min(n, 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        s = 80 + Math.random() * 160;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, c });
    }
  }
  float(x: number, y: number, t: string, c: string) {
    this.texts.push({ x, y, t, life: 0.8, c });
  }
  hit(ms = 120) {
    if (!this.calm) this.shake = ms / 1000;
  }
  update(dt: number) {
    this.shake = Math.max(0, this.shake - dt);
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt;
    }
    for (const t of this.texts) {
      t.y -= 40 * dt;
      t.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.texts = this.texts.filter((t) => t.life > 0);
  }
  pre(ctx: CanvasRenderingContext2D) {
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.font = "600 18px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life * 2));
      ctx.fillStyle = t.c;
      ctx.fillText(t.t, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
  clear() {
    this.parts = [];
    this.texts = [];
    this.shake = 0;
  }
}
