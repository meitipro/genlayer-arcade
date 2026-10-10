// The UNDETERMINED teaser must be finishable with a person's moves only:
// left, still or right, with or without a jump, held for a quarter second.
// A beam search over those moves finds a route, and the route is then replayed
// on a fresh level, which must end at the gate with all three fragments and no fall.
import { expect, it } from "vitest";
import { Teaser } from "@/components/games/undetermined";
import type { Input } from "@/lib/engine/loop";

const DT = 1 / 60;
const STEP = 15; // frames per move
const FRAGMENTS = [
  { x: 540, y: 230 },
  { x: 800 + 700, y: 180 },
  { x: 1600 + 470, y: 260 },
];
const GATE = { x: 2400 - 60, y: 440 - 45 };
const MOVES = [-1, 0, 1].flatMap((d) => [false, true].map((j) => ({ d, j })));
type Move = (typeof MOVES)[number];

function input(m: Move, first: boolean): Input {
  const pressed = new Set<string>();
  if (m.d > 0) pressed.add("ArrowRight");
  if (m.d < 0) pressed.add("ArrowLeft");
  return { pressed, justPressed: new Set(m.j && first ? ["Space"] : []), pointer: { x: 0, y: 0, down: false, tapped: false }, swipe: null };
}

function clone(s: Teaser): Teaser {
  const c = new Teaser(() => {});
  Object.assign(c, { x: s.x, y: s.y, vy: s.vy, ground: s.ground, got: [...s.got], done: s.done, deaths: s.deaths, t: s.t, cam: s.cam });
  return c;
}

function score(s: Teaser): number {
  if (s.done) return 1e9;
  const i = s.got.findIndex((g) => !g);
  const target = i === -1 ? GATE : FRAGMENTS[i];
  return s.got.filter(Boolean).length * 1e5 - Math.hypot(s.x + 14 - target.x, s.y + 14 - target.y);
}

it("a beam search over a person's moves finds a route, and the route finishes the level", () => {
  type Node = { s: Teaser; path: Move[] };
  let beam: Node[] = [{ s: new Teaser(() => {}), path: [] }];
  let found: Move[] | null = null;
  for (let depth = 0; depth < 500 && !found; depth++) {
    const next = new Map<string, Node & { v: number }>();
    for (const n of beam) {
      for (const m of MOVES) {
        const c = clone(n.s);
        for (let f = 0; f < STEP; f++) c.update(DT, input(m, f === 0));
        if (c.deaths > 0) continue;
        const path = [...n.path, m];
        if (c.done) {
          found = path;
          break;
        }
        const key = `${Math.round(c.x / 12)},${Math.round(c.y / 12)},${c.ground},${c.got.join("")}`;
        const v = score(c);
        if (!next.has(key) || next.get(key)!.v < v) next.set(key, { s: c, path, v });
      }
      if (found) break;
    }
    beam = [...next.values()].sort((a, b) => b.v - a.v).slice(0, 60);
  }
  expect(found).not.toBeNull();

  let done: { deaths: number; seconds: number } | null = null;
  const replay = new Teaser((deaths, seconds) => (done = { deaths, seconds }));
  for (const m of found!) for (let f = 0; f < STEP; f++) replay.update(DT, input(m, f === 0));
  expect(replay.got).toEqual([true, true, true]);
  expect(done).toEqual({ deaths: 0, seconds: expect.any(Number) });
});
