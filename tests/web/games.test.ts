// Plays every arcade scene headless with scripted bots: real physics, real
// timing (fixed dt), a no-op canvas. Checks the numbers from BUILD_SPEC
// section 10, and that an honest bot's score rate stays inside the limits in
// lib/games.ts that /api/score enforces (the "tune maxPerSec" step).
import { describe, expect, it } from "vitest";
import { Stack } from "@/components/games/consensus-stack";
import { Snake } from "@/components/games/chain-snake";
import { deal } from "@/components/games/equivalence";
import { Rotation } from "@/components/games/leader-rotation";
import { Run } from "@/components/games/validator-run";
import { Breaker } from "@/components/games/appeal-breaker";
import type { Input, Scene } from "@/lib/engine/loop";
import { gameBySlug } from "@/lib/games";
import pairs from "@/data/equivalence-pairs.json";

const ctx = new Proxy({} as Record<string | symbol, unknown>, {
  get: (t, k) => (k in t ? t[k] : () => undefined),
  set: (t, k, v) => ((t[k] = v), true),
}) as unknown as CanvasRenderingContext2D;

function blankInput(): Input {
  return { pressed: new Set(), justPressed: new Set(), pointer: { x: 0, y: 0, down: false, tapped: false }, swipe: null };
}

type Outcome = { n: number; stats?: Record<string, number> } | null;
function hooks() {
  const h = { live: 0, over: null as Outcome };
  return {
    h,
    hooks: {
      score: (n: number) => (h.live = n),
      over: (n: number, stats?: Record<string, number>) => {
        if (!h.over) h.over = { n, stats };
      },
      running: () => !h.over,
    },
  };
}

/** Steps a scene at a fixed dt; the bot fills the input for each frame. Returns elapsed seconds. */
function play(scene: Scene, h: { over: Outcome }, bot: (input: Input, t: number) => void, maxS: number, dt = 1 / 60): number {
  let t = 0;
  while (t < maxS && !h.over) {
    const input = blankInput();
    bot(input, t);
    scene.update(dt, input);
    scene.draw(ctx);
    t += dt;
  }
  return t;
}

function rateOk(slug: string, score: number, seconds: number) {
  const s = gameBySlug(slug)!.scoring!;
  // the server measures from session start, which is never later than the first frame
  expect(score).toBeLessThanOrEqual(s.cap);
  expect(score).toBeLessThanOrEqual(seconds * s.maxPerSec);
}

describe("Validator Run (10.1)", () => {
  it("an idle node goes offline at the first faulty block", () => {
    const { h, hooks: k } = hooks();
    const run = new Run("#3FE0FF", k);
    const t = play(run, h, () => {}, 20);
    expect(h.over).not.toBeNull();
    expect(t).toBeLessThan(5);
    // distance pays 1 point per 10 px at 320 px/s
    expect(h.over!.n).toBeGreaterThan(t * 32 * 0.8);
  });

  it("speed rises 12 px/s every 5 s from 320, capped at 900; finality doubles for 5 s every 30 s", () => {
    const { hooks: k } = hooks();
    const run = new Run("#3FE0FF", k);
    run.t = 29.99;
    expect(run.finality()).toBe(false);
    run.t = 30.5;
    expect(run.finality()).toBe(true);
    run.t = 35.1;
    expect(run.finality()).toBe(false);
    run.t = 0;
    run.update(0.01, blankInput());
    expect(run.speed).toBe(320);
    run.t = 49.99;
    run.update(0.01, blankInput());
    expect(run.speed).toBe(320 + 12 * 10);
    run.t = 1000;
    run.update(0.01, blankInput());
    expect(run.speed).toBe(900);
  });

  it("a jumping bot survives for minutes, so a jumpable path always exists, and stays under maxPerSec", () => {
    for (let seed = 0; seed < 3; seed++) {
      const { h, hooks: k } = hooks();
      const run = new Run("#3FE0FF", k);
      let holdUntil = -1;
      const bot = (input: Input, t: number) => {
        const front = 150 + 34;
        const near = run.obs.find((o) => o.kind === "fault" && o.x + o.w > 150 && o.x - front < run.speed * 0.15 + 10);
        if (near && run.ground) {
          input.justPressed.add("Space");
          holdUntil = t + 0.05;
        }
        if (t < holdUntil) input.pressed.add("Space");
      };
      const t = play(run, h, bot, 240);
      expect(t).toBeGreaterThan(120);
      rateOk("validator-run", h.over?.n ?? h.live, t);
    }
  });

  it("appeal rings stack to 2 and absorb a hit", () => {
    const { h, hooks: k } = hooks();
    const run = new Run("#3FE0FF", k);
    run.appeals = 2;
    run.obs.push({ x: 150, y: 386, w: 30, h: 34, kind: "fault" });
    run.update(1 / 60, blankInput());
    expect(h.over).toBeNull();
    expect(run.appeals).toBe(1);
  });
});

describe("Consensus Stack (10.2)", () => {
  it("perfect drops score 10 + 25, regrow after three in a row, and stay under maxPerSec", () => {
    const { h, hooks: k } = hooks();
    const s = new Stack("#9B7BFF", k);
    let lastBlocks = 0;
    let t = 0;
    const widths: number[] = [];
    while (s.level < 60 && t < 600) {
      const input = blankInput();
      if (Math.abs(s.offset()) <= 1.5) input.justPressed.add("Space");
      s.update(1 / 480, input);
      t += 1 / 480;
      if (s.level !== lastBlocks) {
        lastBlocks = s.level;
        widths.push(s.tower[s.tower.length - 1].w);
      }
    }
    expect(h.over).toBeNull();
    expect(s.perfects).toBe(60);
    expect(s.points).toBe(60 * 35);
    expect(Math.max(...widths)).toBeLessThanOrEqual(300);
    rateOk("consensus-stack", s.points, t);
  });

  it("slide speed is 180 px/s, +20 every 5 blocks, capped at 520", () => {
    const { hooks: k } = hooks();
    const s = new Stack("#9B7BFF", k);
    expect(s.speed()).toBe(180);
    for (let i = 0; i < 5; i++) s.tower.push({ x: 250, w: 300 });
    expect(s.speed()).toBe(200);
    for (let i = 0; i < 200; i++) s.tower.push({ x: 250, w: 300 });
    expect(s.speed()).toBe(520);
  });

  it("zero overlap ends the run: no majority", () => {
    const { h, hooks: k } = hooks();
    const s = new Stack("#9B7BFF", k);
    s.tower[0].w = 10; // a very narrow top: an early drop misses it entirely
    s.cur.w = 10;
    const input = blankInput();
    input.justPressed.add("Space");
    s.update(1 / 60, input);
    expect(h.over).not.toBeNull();
  });
});

describe("Leader Rotation (10.3)", () => {
  it("a 200 ms reflex bot plays the full 60 s, reaches combo x8 and stays under the cap and rate", () => {
    const { h, hooks: k } = hooks();
    const r = new Rotation("#FFB547", k);
    const t = play(
      r,
      h,
      (input) => {
        r.nodes.forEach((n, i) => {
          if (n.state === "leader" && n.total - n.left >= 0.2) input.justPressed.add(["KeyQ", "KeyW", "KeyE", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyX", "KeyC"][i]);
        });
      },
      70,
    );
    expect(h.over).not.toBeNull();
    expect(t).toBeGreaterThanOrEqual(60);
    expect(t).toBeLessThan(60.1);
    expect(h.over!.stats!.maxCombo).toBe(8);
    expect(h.over!.stats!.n).toBe(r.led);
    // the window shrinks 25 ms per hit to a 380 ms floor
    expect(r.window).toBeCloseTo(Math.max(0.38, 1.1 - 0.025 * r.led), 5);
    rateOk("leader-rotation", h.over!.n, 60);
  });

  it("tapping a faulty node slashes 30 points and the combo", () => {
    const { hooks: k } = hooks();
    const r = new Rotation("#FFB547", k);
    r.points = 100;
    r.combo = 5;
    r.nodes[4] = { state: "faulty", left: 1, total: 1, pop: 0 };
    r.tap(4);
    expect(r.points).toBe(70);
    expect(r.combo).toBe(0);
  });
});

describe("Equivalence (10.4)", () => {
  it("deals 6, 8 and 10 pairs; level 3 adds the decoys and every look-alike", () => {
    expect(deal(0)).toHaveLength(12);
    expect(deal(1)).toHaveLength(16);
    const l3 = deal(2);
    expect(l3.filter((c) => !c.decoy)).toHaveLength(20);
    expect(l3.filter((c) => c.decoy)).toHaveLength(pairs.decoys.length);
    for (const [a] of pairs.decoys) expect(l3.some((c) => c.text === a)).toBe(true);
    for (const c of l3.filter((x) => !x.decoy)) expect(l3.filter((x) => x.pair === c.pair && !x.decoy)).toHaveLength(2);
  });
});

describe("Chain Snake (10.5)", () => {
  function bfs(s: Snake): string | null {
    const COLS = 24,
      ROWS = 15;
    const head = s.body[0];
    const blocked = new Set(s.body.slice(0, -1).map((p) => `${p.x},${p.y}`));
    if (s.fault) blocked.add(`${s.fault.x},${s.fault.y}`);
    const q: { x: number; y: number; first: string | null }[] = [{ x: head.x, y: head.y, first: null }];
    const seen = new Set([`${head.x},${head.y}`]);
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as const;
    while (q.length) {
      const c = q.shift()!;
      if (c.x === s.food.x && c.y === s.food.y) return c.first;
      for (const [k, [dx, dy]] of Object.entries(dirs)) {
        const n = { x: c.x + dx, y: c.y + dy };
        const key = `${n.x},${n.y}`;
        if (n.x < 0 || n.y < 0 || n.x >= COLS || n.y >= ROWS || blocked.has(key) || seen.has(key)) continue;
        seen.add(key);
        q.push({ ...n, first: c.first ?? k });
      }
    }
    return null;
  }

  it("a path-finding bot finalizes blocks, ticks get faster to the 70 ms floor, and stays under maxPerSec", () => {
    const { h, hooks: k } = hooks();
    const s = new Snake("#B8F35A", k);
    let steps = 0;
    const t = play(
      s,
      h,
      (input) => {
        // decide once per tick, like a player
        if (Math.floor(s.acc / s.tick()) === 0 && steps++ % 1 === 0) {
          const d = bfs(s);
          if (d) input.justPressed.add(d);
        }
      },
      180,
    );
    const score = h.over?.n ?? h.live;
    expect(s.blocks).toBeGreaterThanOrEqual(3);
    expect(s.points).toBe(s.eaten * 10 + s.blocks * 50);
    expect(s.tick()).toBeCloseTo(Math.max(0.07, 0.14 - 0.004 * s.blocks), 6);
    expect(s.fin.filter(Boolean).length).toBe(Math.min(s.fin.length, s.blocks * 5));
    rateOk("chain-snake", score, t);
  });

  it("hitting a wall is a fork", () => {
    const { h, hooks: k } = hooks();
    const s = new Snake("#B8F35A", k);
    s.food = { x: 0, y: 0 };
    play(s, h, () => {}, 10);
    expect(h.over).not.toBeNull();
    expect(s.body[0].x).toBe(23);
  });
});

describe("Appeal Breaker (10.6)", () => {
  it("a tracking bot clears waves; +15 per hit point; stays under the cap and maxPerSec", () => {
    const { h, hooks: k } = hooks();
    const b = new Breaker("#FF4FD8", k);
    let hp = b.bricks.reduce((a, x) => a + x.max, 0);
    let wave = 0;
    let earned = 0;
    const t = play(
      b,
      h,
      (input) => {
        if (b.wave !== wave) {
          earned += hp * 15;
          wave = b.wave;
          hp = b.bricks.reduce((a, x) => a + x.max, 0);
        }
        // like a player: meet the lowest ball, off-centre so it leaves at an angle
        const low = [...b.balls].sort((x, y) => y.y - x.y)[0];
        if (low) input.pointer.x = low.x + (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 35);
        if (b.balls.some((x) => x.stuck)) input.justPressed.add("Space");
      },
      1800,
      1 / 120,
    );
    expect(h.over).not.toBeNull();
    expect(b.wave).toBeGreaterThanOrEqual(1);
    expect(h.over!.n).toBeGreaterThanOrEqual(earned);
    rateOk("appeal-breaker", h.over!.n, t);
  });
});
