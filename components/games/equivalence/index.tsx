"use client";
// 10.4 Equivalence. A memory game where pairs are not identical but
// equivalent: two different sentences that mean the same thing.
import { useCallback, useEffect, useRef, useState } from "react";
import data from "@/data/equivalence-pairs.json";
import { sfx } from "@/lib/engine/sfx";
import type { GameProps } from "../../GameShell";

// ---- every number from section 10.4 ----
const MATCH = 100;
const WRONG = -10;
const FLIP_BACK_MS = 700;
const RUN_S = 90;
const LEVELS = [
  { pairs: 6, preview: 2000, decoys: false },
  { pairs: 8, preview: 1000, decoys: false },
  { pairs: 10, preview: 0, decoys: true },
];
/** remaining-time bonus: one point per 3 seconds left (up to 30) */
const timeBonus = (left: number) => Math.floor(left / 3);

type Card = { id: number; text: string; pair: number; decoy: boolean; state: "down" | "up" | "matched"; stamp?: boolean };

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function deal(level: number): Card[] {
  const L = LEVELS[level];
  const pairs = data.pairs as [string, string][];
  const decoys = data.decoys as [string, string][];
  let chosen: number[];
  if (L.decoys) {
    // every decoy's look-alike must be on the table, so its pair is in the deck
    const must = decoys.map(([a]) => pairs.findIndex(([x]) => x === a)).filter((i) => i >= 0);
    const rest = shuffle(pairs.map((_, i) => i).filter((i) => !must.includes(i)));
    chosen = [...must, ...rest].slice(0, L.pairs);
  } else chosen = shuffle(pairs.map((_, i) => i)).slice(0, L.pairs);
  let id = 0;
  const cards: Card[] = [];
  for (const p of chosen) {
    cards.push({ id: id++, text: pairs[p][0], pair: p, decoy: false, state: "down" });
    cards.push({ id: id++, text: pairs[p][1], pair: p, decoy: false, state: "down" });
  }
  if (L.decoys) for (const [, d] of decoys) cards.push({ id: id++, text: d, pair: -1, decoy: true, state: "down" });
  return shuffle(cards);
}

export default function Equivalence({ running, accent, onScore, onGameOver }: GameProps) {
  const [level, setLevel] = useState(0);
  const [cards, setCards] = useState<Card[]>(() => deal(0));
  const [left, setLeft] = useState(RUN_S);
  const [score, setScore] = useState(0);
  const [found, setFound] = useState(0);
  const [preview, setPreview] = useState(true);
  const [focus, setFocus] = useState(0);
  const [cleared, setCleared] = useState(0);
  const busy = useRef(false);
  const open = useRef<number[]>([]);
  const done = useRef(false);
  const leftRef = useRef(RUN_S);
  const scoreRef = useRef(0);
  const grid = useRef<HTMLDivElement>(null);
  const foundRef = useRef(0);

  const finish = useCallback(
    (clearedLevels: number) => {
      if (done.current) return;
      done.current = true;
      onGameOver(scoreRef.current, { cleared: clearedLevels, n: foundRef.current });
    },
    [onGameOver],
  );

  // preview flash at the start of each level (2 s, 1 s, none)
  useEffect(() => {
    const ms = LEVELS[level].preview;
    if (!ms) {
      setPreview(false);
      return;
    }
    setPreview(true);
    const t = setTimeout(() => setPreview(false), ms);
    return () => clearTimeout(t);
  }, [level]);

  // the 90 s run timer
  useEffect(() => {
    if (!running) return;
    const started = performance.now() - (RUN_S - leftRef.current) * 1000;
    const t = setInterval(() => {
      if (document.hidden || done.current) return;
      const l = Math.max(0, RUN_S - (performance.now() - started) / 1000);
      leftRef.current = l;
      setLeft(l);
      if (l <= 0) finish(cleared);
    }, 100);
    return () => clearInterval(t);
  }, [running, finish, cleared]);

  useEffect(() => grid.current?.focus({ preventScroll: true }), []);

  const add = (n: number) => {
    scoreRef.current = Math.max(0, scoreRef.current + n);
    setScore(scoreRef.current);
    onScore?.(scoreRef.current);
  };

  const flip = (idx: number) => {
    if (!running || done.current || busy.current || preview) return;
    const c = cards[idx];
    if (!c || c.state !== "down") return;
    sfx.whoosh();
    const next = cards.map((x, i) => (i === idx ? { ...x, state: "up" as const, stamp: false } : x));
    open.current = [...open.current, idx];
    setCards(next);
    if (open.current.length < 2) return;
    const [i, j] = open.current;
    open.current = [];
    const a = next[i],
      b = next[j];
    if (!a.decoy && !b.decoy && a.pair === b.pair) {
      sfx.match();
      add(MATCH + timeBonus(leftRef.current));
      foundRef.current += 1;
      setFound(foundRef.current);
      const after = next.map((x, k) => (k === i || k === j ? { ...x, state: "matched" as const } : x));
      setCards(after);
      const remaining = after.filter((x) => !x.decoy && x.state !== "matched").length;
      if (remaining === 0) {
        const nowCleared = level + 1;
        setCleared(nowCleared);
        if (level === LEVELS.length - 1) finish(nowCleared);
        else
          setTimeout(() => {
            setLevel(level + 1);
            setCards(deal(level + 1));
            setFocus(0);
          }, 600);
      }
    } else {
      sfx.mismatch();
      add(WRONG);
      busy.current = true;
      // decoys get a small "not equivalent" stamp when wrongly paired
      const stamped = next.map((x, k) => (k === i || k === j ? { ...x, stamp: x.decoy } : x));
      setCards(stamped);
      setTimeout(() => {
        setCards((cs) => cs.map((x, k) => (k === i || k === j ? { ...x, state: "down" as const } : x)));
        busy.current = false;
      }, FLIP_BACK_MS);
    }
  };

  const cols = cards.length > 16 ? 6 : 4;
  const onKey = (e: React.KeyboardEvent) => {
    const n = cards.length;
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
    if (e.key in moves) {
      e.preventDefault();
      setFocus((f) => (f + moves[e.key] + n) % n);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip(focus);
    }
  };

  return (
    <div className="bg-bg p-3 sm:p-5">
      <div className="mono mb-3 flex items-center justify-between text-sm">
        <span className="uppercase text-muted">
          equivalence level {level + 1}
          {preview ? "  preview" : ""}
        </span>
        <span className="text-muted">
          <span className={left < 10 ? "text-danger" : ""}>{Math.ceil(left)}s</span>
          <span className="ml-4" style={{ color: accent }}>
            {String(score).padStart(5, "0")}
          </span>
        </span>
      </div>
      <div
        ref={grid}
        tabIndex={0}
        onKeyDown={onKey}
        role="grid"
        aria-label="Equivalence cards. Arrow keys move, Enter flips."
        className="grid gap-2 outline-none sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cards.map((c, i) => {
          const up = preview || c.state !== "down";
          return (
            <button
              key={`${level}-${c.id}`}
              type="button"
              tabIndex={-1}
              onClick={() => (setFocus(i), flip(i))}
              aria-label={up ? c.text : "face-down card"}
              className={`flip h-20 sm:h-24 ${up ? "is-up" : ""} ${focus === i ? "ring-2 ring-accent rounded-xl" : ""}`}
            >
              <span className="flip-inner block">
                <span className="flip-face grid place-items-center border border-line bg-raised">
                  <span className="mono text-lg text-muted">GL</span>
                </span>
                <span
                  className="flip-face flip-back grid place-items-center border p-2 text-center text-[11px] leading-tight sm:text-sm"
                  style={{
                    borderColor: c.state === "matched" ? accent : "var(--line)",
                    background: c.state === "matched" ? `color-mix(in srgb, ${accent} 16%, var(--surface))` : "var(--surface)",
                    boxShadow: c.state === "matched" ? `0 0 18px color-mix(in srgb, ${accent} 35%, transparent)` : undefined,
                  }}
                >
                  {c.text}
                  {c.state === "matched" && (
                    <svg className="absolute right-1.5 top-1.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" aria-hidden>
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {c.stamp && c.state === "up" && (
                    <span className="mono absolute bottom-1 left-0 right-0 text-[10px] uppercase text-danger">not equivalent</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mono mt-3 text-xs text-muted">{found} equivalences found</p>
    </div>
  );
}
