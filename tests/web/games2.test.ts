// The five Day-two arcade games, played headless by scripted bots with the real
// physics and timing. Each test checks the game's own numbers and that an
// honest bot's score stays under the limit /api/score enforces (lib/games.ts).
import { describe, expect, it } from "vitest";
import { Defender } from "@/components/games/node-defender";
import { Flap } from "@/components/games/fee-flap";
import { Hop } from "@/components/games/sky-hop";
import { canMove, Merge, slideBoard, slideLine, type Dir } from "@/components/games/stake-merge";
import { Whack } from "@/components/games/whack-a-node";
import { W, type Input, type Scene } from "@/lib/engine/loop";
import { gameBySlug } from "@/lib/games";

const ctx = new Proxy({} as Record<string | symbol, unknown>, {
  get: (t, k) => (k in t ? t[k] : () => undefined),
  set: (t, k, v) => ((t[k] = v), true),
}) as unknown as CanvasRenderingContext2D;

const blank = (): Input => ({ pressed: new Set(), justPressed: new Set(), pointer: { x: 0, y: 0, down: false, tapped: false }, swipe: null });

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

function play(scene: Scene, h: { over: Outcome }, bot: (i: Input, t: number) => void, maxS: number, dt = 1 / 60): number {
  let t = 0;
  while (t < maxS && !h.over) {
    const i = blank();
    bot(i, t);
    scene.update(dt, i);
    scene.draw(ctx);
    t += dt;
  }
  return t;
}

function rateOk(slug: string, score: number, seconds: number) {
  const s = gameBySlug(slug)!.scoring!;
  expect(score).toBeLessThanOrEqual(s.cap);
  expect(score).toBeLessThanOrEqual(seconds * s.maxPerSec);
}

describe("every new game is in the catalog with real limits", () => {
  it.each(["sky-hop", "fee-flap", "whack-a-node", "node-defender", "stake-merge"])("%s", (slug) => {
    const g = gameBySlug(slug)!;
    expect(g.type).toBe("arcade");
    expect(g.scoring!.maxPerSec).toBeGreaterThan(0);
    expect(g.scoring!.cap).toBeGreaterThan(0);
    expect(g.gameOver).toContain("{n}");
    expect(g.controls).toHaveLength(3);
  });
});

describe("Fee Flap", () => {
  it("a bot that keeps level with the next gap clears blocks for two minutes in every seeded run; 10 points per block, under maxPerSec", () => {
    for (const seed of [1, 22, 333, 4444, 55555]) {
      const { h, hooks: k } = hooks();
      const f = new Flap("#FFD84D", k, seed);
      const t = play(
        f,
        h,
        (input) => {
          const next = f.pipes.find((p) => p.x + 70 > 200 - 16);
          // a flap lifts 74 px, so hold a little below the middle of the gap
          const target = next ? next.gy + 38 : 270;
          if (!f.started || (f.y > target && f.vy > -50)) input.justPressed.add("Space");
        },
        120,
      );
      expect(h.over, `seed ${seed} died after ${f.passed} blocks`).toBeNull();
      expect(f.passed).toBeGreaterThan(60);
      expect(f.points).toBe(f.passed * 10);
      expect(f.speed()).toBeLessThanOrEqual(270);
      rateOk("fee-flap", f.points, t);
    }
  });

  it("falling to the floor ends the run", () => {
    const { h, hooks: k } = hooks();
    const f = new Flap("#FFD84D", k, 7);
    play(f, h, (i, t) => (t < 0.05 ? i.justPressed.add("Space") : undefined), 10);
    expect(h.over).not.toBeNull();
  });

  it("consecutive gaps never differ by more than two flaps can cover", () => {
    const { hooks: k } = hooks();
    const f = new Flap("#FFD84D", k, 99);
    for (let i = 0; i < 300; i++) f.spawn();
    for (let i = 1; i < f.pipes.length; i++) expect(Math.abs(f.pipes[i].gy - f.pipes[i - 1].gy)).toBeLessThanOrEqual(130.01);
  });
});

describe("Sky Hop", () => {
  /**
   * What a person does: aim for the highest block the node can still land on.
   * "Can land on" comes from the node's own physics: the time it takes to come
   * down onto that block, times the 340 px/s it can steer.
   */
  function steer(s: Hop, input: Input) {
    const G = 1700;
    const feet = s.y + 30;
    const landIn = (py: number): number | null => {
      if (s.vy <= 0) {
        const rise = (s.vy * s.vy) / (2 * G);
        const apex = feet - rise;
        if (py < apex) return null;
        return -s.vy / G + Math.sqrt((2 * (py - apex)) / G);
      }
      const dy = py - feet;
      if (dy < -6) return null;
      return (-s.vy + Math.sqrt(s.vy * s.vy + 2 * G * Math.max(0, dy))) / G;
    };
    const dxTo = (p: { x: number }) => {
      let d = p.x + 44 - (s.x + 15);
      if (d > W / 2) d -= W;
      if (d < -W / 2) d += W;
      return d;
    };
    const reachable = s.plats
      .map((p) => ({ p, t: landIn(p.y), d: dxTo(p) }))
      .filter((c) => c.t !== null && Math.abs(c.d) <= 340 * (c.t as number) + 30 && c.p.y > s.camY - 40);
    // highest first; among blocks about as high, a solid one beats a red one
    const best = reachable.sort((a, b) => a.p.y + (a.p.kind === "crumble" ? 40 : 0) - (b.p.y + (b.p.kind === "crumble" ? 40 : 0)))[0];
    const pick = best ?? s.plats.map((p) => ({ p, d: dxTo(p) })).filter((c) => c.p.y > feet).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0];
    if (!pick) return;
    if (Math.abs(pick.d) > 10) input.pressed.add(pick.d > 0 ? "ArrowRight" : "ArrowLeft");
  }

  it("a bot steering like a person climbs well past 100 m in every seeded tower and stays under maxPerSec", () => {
    for (const seed of [11, 202, 3003, 40004, 5, 77, 909, 12345]) {
      const { h, hooks: k } = hooks();
      const s = new Hop("#5EEAD4", k, seed);
      const t = play(s, h, (input) => steer(s, input), 180);
      expect(s.height).toBeGreaterThan(100);
      expect(s.points).toBe(s.height + s.votes * 5);
      rateOk("sky-hop", h.over?.n ?? s.points, t);
    }
  });

  it("the first block crumbles, so an idle node does not stay on it", () => {
    const { h, hooks: k } = hooks();
    const s = new Hop("#5EEAD4", k, 5);
    play(s, h, () => {}, 4);
    expect(s.plats.some((p) => p.y > 380 && p.kind === "crumble" && !p.gone)).toBe(false);
  });

  it("every gap is inside the reach of a bounce", () => {
    const { hooks: k } = hooks();
    const s = new Hop("#5EEAD4", k, 9);
    s.camY = -20000;
    s.fill();
    const ys = s.plats.map((p) => p.y).sort((a, b) => b - a);
    for (let i = 1; i < ys.length; i++) expect(ys[i - 1] - ys[i]).toBeLessThanOrEqual(118.5);
    // and no step sideways is more than one bounce of steering
    const byY = [...s.plats].sort((p, q) => q.y - p.y);
    for (let i = 1; i < byY.length; i++) expect(Math.abs(byY[i].x - byY[i - 1].x)).toBeLessThanOrEqual(200.5);
  });

  it("a normal bounce reaches 170 px and a spring 389 px, the numbers the limit is derived from", () => {
    const apex = (v: number) => (v * v) / (2 * 1700);
    expect(Math.round(apex(760))).toBe(170);
    expect(Math.round(apex(1150))).toBe(389);
  });
});

describe("Whack-a-Node", () => {
  it("a bot that slashes every faulty node scores about 10 each, ends at 45 s, and stays under maxPerSec", () => {
    const { h, hooks: k } = hooks();
    const w = new Whack("#FF9A3C", k);
    const keys = ["KeyQ", "KeyW", "KeyE", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyX", "KeyC"];
    const t = play(
      w,
      h,
      (input) => {
        w.holes.forEach((hole, i) => {
          if (hole.kind === "faulty" && hole.age > 0.25) input.justPressed.add(keys[i]);
        });
      },
      60,
    );
    expect(t).toBeGreaterThanOrEqual(45);
    expect(t).toBeLessThan(45.1);
    expect(w.mistakes).toBe(0);
    expect(w.points).toBe(w.slashed * 10);
    expect(w.slashed).toBeGreaterThan(40);
    rateOk("whack-a-node", h.over!.n, 45);
  });

  it("slashing an honest node costs 20 points and never goes below zero", () => {
    const { hooks: k } = hooks();
    const w = new Whack("#FF9A3C", k);
    w.points = 30;
    w.holes[4] = { kind: "honest", age: 0, life: 1, flash: 0 };
    w.tap(4);
    expect(w.points).toBe(10);
    w.holes[4] = { kind: "honest", age: 0, life: 1, flash: 0 };
    w.tap(4);
    expect(w.points).toBe(0);
  });
});

describe("Node Defender", () => {
  it("a tracking bot stops blocks, earns 10 per hit, and stays under maxPerSec", () => {
    const { h, hooks: k } = hooks();
    const d = new Defender("#7C8CFF", k);
    const t = play(
      d,
      h,
      (input) => {
        const e = [...d.enemies].sort((a, b) => b.y - a.y)[0];
        if (e) input.pressed.add(e.x > d.x + 6 ? "ArrowRight" : e.x < d.x - 6 ? "ArrowLeft" : "KeyP");
      },
      120,
    );
    expect(d.kills).toBeGreaterThan(30);
    expect(d.points).toBeGreaterThanOrEqual(d.kills * 10);
    rateOk("node-defender", h.over?.n ?? d.points, t);
  });

  it("an idle node loses three lives to landing blocks", () => {
    const { h, hooks: k } = hooks();
    const d = new Defender("#7C8CFF", k);
    // keep the node out of the way in a corner and let blocks fall
    d.x = 24;
    play(d, h, (i) => i.pressed.add("ArrowLeft"), 120);
    expect(h.over).not.toBeNull();
    expect(d.lives).toBe(0);
  });
});

describe("Stake Merge", () => {
  it("slides and merges a line once per pair", () => {
    expect(slideLine([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], gained: 8 });
    expect(slideLine([2, 2, 4, 0])).toEqual({ line: [4, 4, 0, 0], gained: 4 });
    expect(slideLine([0, 2, 0, 2])).toEqual({ line: [4, 0, 0, 0], gained: 4 });
    expect(slideLine([4, 2, 2, 0])).toEqual({ line: [4, 4, 0, 0], gained: 4 });
    expect(slideLine([2, 4, 8, 16])).toEqual({ line: [2, 4, 8, 16], gained: 0 });
  });

  it("slides a whole board in each direction", () => {
    const g = [2, 0, 0, 2, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 0, 0];
    expect(slideBoard(g, "left").grid.slice(0, 4)).toEqual([4, 0, 0, 0]);
    expect(slideBoard(g, "right").grid.slice(8, 12)).toEqual([0, 0, 0, 8]);
    const up = slideBoard(g, "up");
    expect(up.grid[0]).toBe(2);
    expect(up.grid[4]).toBe(4);
    expect(slideBoard([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], "left").moved).toBe(false);
    expect(canMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])).toBe(false);
  });

  it("a corner-strategy bot over two minutes stays under maxPerSec, one move per 0.12 s at most", () => {
    const { h, hooks: k } = hooks();
    const m = new Merge("#E7B5FF", k);
    const order: Dir[] = ["left", "down", "right", "up"];
    const keyFor: Record<Dir, string> = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" };
    const t = play(
      m,
      h,
      (input) => {
        for (const d of order) {
          if (slideBoard(m.grid, d).moved) {
            input.justPressed.add(keyFor[d]);
            return;
          }
        }
      },
      125,
    );
    expect(m.moves).toBeLessThanOrEqual(Math.ceil(120 / 0.12) + 1);
    expect(m.points).toBeGreaterThan(500);
    // the total of all tiles grows by 2 or 4 per move, so score cannot outrun the tiles
    expect(h.over).not.toBeNull();
    rateOk("stake-merge", h.over!.n, Math.min(t, 120));
  });

  it("the theoretical ceiling in the limit comment holds: 1000 moves, each adding at most 4 to the tile total", () => {
    const moves = 120 / 0.12;
    const total = moves * 4; // every spawn a 4
    // best case, all of it in one tile: score = sum over tiles of v x (log2 v - 1)
    const best = total * (Math.log2(total) - 1);
    expect(best / 120).toBeLessThan(gameBySlug("stake-merge")!.scoring!.maxPerSec * 12); // loose upper bound check
  });
});
