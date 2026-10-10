"use client";
// Mounts one Scene on the shared loop (lib/engine/loop.ts). The shell remounts
// this component per run, so a scene lives exactly one run.
import { useEffect, useRef } from "react";
import { startLoop, type Scene } from "@/lib/engine/loop";
import type { GameProps } from "../GameShell";

export type Hooks = {
  /** Live score for the HUD; only forwarded when it changes. */
  score(n: number): void;
  /** Called once, when the run ends. */
  over(n: number, stats?: Record<string, number>): void;
  running(): boolean;
};

export function CanvasGame({ props, make, label }: { props: GameProps; make: (accent: string, hooks: Hooks) => Scene; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    let last = -1;
    let done = false;
    const hooks: Hooks = {
      score: (n) => {
        const v = Math.floor(n);
        if (v !== last) {
          last = v;
          latest.current.onScore?.(v);
        }
      },
      over: (n, stats) => {
        if (done) return;
        done = true;
        latest.current.onGameOver(Math.floor(n), stats);
      },
      running: () => latest.current.running && !done,
    };
    const scene = make(props.accent, hooks);
    const canvas = ref.current!;
    canvas.focus({ preventScroll: true });
    return startLoop(canvas, scene, { paused: () => !latest.current.running });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <canvas
      ref={ref}
      tabIndex={0}
      aria-label={label}
      className="block aspect-[16/10] w-full touch-none select-none bg-bg outline-none"
    />
  );
}
