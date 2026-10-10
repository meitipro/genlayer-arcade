// lib/engine/loop.ts (shared by every arcade game, section 9).
// Fixed 800x500 logical canvas scaled to the device, delta time clamped so games
// behave the same at 60Hz and 120Hz, keyboard plus pointer plus swipe input,
// auto-pause when the tab is hidden.
export type Input = {
  pressed: Set<string>;
  justPressed: Set<string>;
  pointer: { x: number; y: number; down: boolean; tapped: boolean };
  swipe: "up" | "down" | "left" | "right" | null;
};

export type Scene = {
  update(dt: number, input: Input): void; // dt in seconds, clamped to 1/20
  draw(ctx: CanvasRenderingContext2D): void;
};

export const W = 800,
  H = 500; // logical resolution for every game

const BLOCKED = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export function startLoop(canvas: HTMLCanvasElement, scene: Scene, opts: { paused?: () => boolean } = {}) {
  const ctx = canvas.getContext("2d")!;
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || W;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(((w * H) / W) * dpr);
    ctx.setTransform((w * dpr) / W, 0, 0, (w * dpr) / W, 0, 0);
  };
  fit();
  window.addEventListener("resize", fit);

  const input: Input = {
    pressed: new Set(),
    justPressed: new Set(),
    pointer: { x: 0, y: 0, down: false, tapped: false },
    swipe: null,
  };

  const toLogical = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  let start: { x: number; y: number } | null = null;
  const typing = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  };
  const kd = (e: KeyboardEvent) => {
    if (typing(e)) return;
    if (!input.pressed.has(e.code)) input.justPressed.add(e.code);
    input.pressed.add(e.code);
    if (BLOCKED.includes(e.code)) e.preventDefault();
  };
  const ku = (e: KeyboardEvent) => input.pressed.delete(e.code);
  const pd = (e: PointerEvent) => {
    const p = toLogical(e);
    Object.assign(input.pointer, p, { down: true, tapped: true });
    start = p;
  };
  const pu = (e: PointerEvent) => {
    input.pointer.down = false;
    if (!start) return;
    const p = toLogical(e),
      dx = p.x - start.x,
      dy = p.y - start.y;
    if (Math.hypot(dx, dy) > 30) input.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    start = null;
  };
  const pm = (e: PointerEvent) => Object.assign(input.pointer, toLogical(e));
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  canvas.addEventListener("pointerdown", pd);
  window.addEventListener("pointerup", pu);
  canvas.addEventListener("pointermove", pm);

  let last = performance.now(),
    raf = 0,
    hidden = document.hidden;
  const vis = () => {
    hidden = document.hidden;
    last = performance.now();
  };
  document.addEventListener("visibilitychange", vis);
  const frame = (t: number) => {
    const dt = Math.min((t - last) / 1000, 1 / 20);
    last = t;
    if (!hidden && !opts.paused?.()) scene.update(dt, input);
    scene.draw(ctx);
    input.justPressed.clear();
    input.pointer.tapped = false;
    input.swipe = null;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", fit);
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keyup", ku);
    window.removeEventListener("pointerup", pu);
    canvas.removeEventListener("pointerdown", pd);
    canvas.removeEventListener("pointermove", pm);
    document.removeEventListener("visibilitychange", vis);
  };
}

/** prefers-reduced-motion: games skip screen shake and big particle bursts. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Shared drawing helpers so every game speaks the same visual language (section 6). */
export const COLORS = {
  bg: "#08080C",
  surface: "#12121A",
  raised: "#1C1C27",
  line: "#23232F",
  text: "#EDEDF2",
  muted: "#8A8A9A",
  danger: "#FF5C7A",
};

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A vote: an outlined diamond. */
export function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, fill = false) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

export function hud(ctx: CanvasRenderingContext2D, left: string, right: string, accent: string) {
  ctx.font = "600 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(left.toUpperCase(), 20, 18);
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.fillText(right, W - 20, 18);
  ctx.textAlign = "left";
}

export const pad = (n: number, w = 5) => {
  const s = String(Math.max(0, Math.floor(n))).padStart(w, "0");
  return s.length > 3 ? s.slice(0, s.length - 3) + "," + s.slice(-3) : s;
};

export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Mix a hex color toward the background: t=0 background, t=1 full color. */
export function dim(hex: string, t: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const bg = [0x1c, 0x1c, 0x27];
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(bg[i] + (v - bg[i]) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
