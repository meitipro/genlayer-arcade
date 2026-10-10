"use client";
// GameShell: READY overlay -> POST session/start -> running -> onGameOver ->
// POST score -> show score, best, rank, ConceptCard, Play again, Share (section 9).
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ComponentType } from "react";
import { postJson, usePlayer } from "@/lib/client/player";
import type { Game } from "@/lib/games";
import { AccentStyle } from "./AccentStyle";
import { ConceptCard } from "./ConceptCard";
import { Leaderboard, useBoard } from "./Leaderboard";
import { NicknameGate } from "./NicknameGate";

// every game exports one component with this signature
export type GameProps = {
  running: boolean; // shell sets true after session/start succeeds
  accent: string; // from lib/games.ts
  onScore?: (live: number) => void; // HUD
  onGameOver: (finalScore: number, stats?: Record<string, number>) => void;
};
// stats (perfects, maxCombo, blocks, level) feed badges in Tier B.

const loading = () => <div className="aspect-[16/10] w-full animate-pulse bg-raised" />;
const COMPONENTS: Record<string, ComponentType<GameProps>> = {
  "validator-run": dynamic(() => import("@/components/games/validator-run"), { ssr: false, loading }),
  "consensus-stack": dynamic(() => import("@/components/games/consensus-stack"), { ssr: false, loading }),
  "leader-rotation": dynamic(() => import("@/components/games/leader-rotation"), { ssr: false, loading }),
  equivalence: dynamic(() => import("@/components/games/equivalence"), { ssr: false, loading }),
  "chain-snake": dynamic(() => import("@/components/games/chain-snake"), { ssr: false, loading }),
  "appeal-breaker": dynamic(() => import("@/components/games/appeal-breaker"), { ssr: false, loading }),
};

type Phase = "ready" | "starting" | "running" | "posting" | "over";
type Result = { score: number; n: number; posted: boolean; error?: string; best?: number | null; rank?: number | null; badges?: string[]; eventRank?: number | null };

export function GameShell({ game }: { game: Game }) {
  const Comp = COMPONENTS[game.slug];
  const player = usePlayer();
  const [phase, setPhase] = useState<Phase>("ready");
  const [run, setRun] = useState(0);
  const [live, setLive] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [bump, setBump] = useState(0);
  const token = useRef<string>("");
  // tournament mode: /play/<slug>?room=CODE
  const [room, setRoom] = useState<string | null>(null);
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("room");
    if (r) setRoom(r.toUpperCase());
  }, []);
  const { board } = useBoard(game.slug, "season", 10, bump);

  const start = useCallback(async () => {
    if (!player || phase === "starting" || phase === "running" || phase === "posting") return;
    setError("");
    setPhase("starting");
    const r = await postJson<{ token: string }>("/api/session/start", { game: game.slug, ...(room ? { room } : {}) });
    if (!r.ok) {
      setPhase(result ? "over" : "ready");
      setError(r.data.error ?? "could not start a session, try again");
      return;
    }
    token.current = r.data.token;
    setResult(null);
    setLive(0);
    setRun((n) => n + 1);
    setPhase("running");
  }, [player, phase, game.slug, result, room]);

  const over = useCallback(
    async (finalScore: number, stats?: Record<string, number>) => {
      const score = Math.max(0, Math.floor(finalScore));
      setPhase("posting");
      setLive(score);
      if (!player) return;
      const r = await postJson<{ best: number; rank: number; badges: string[]; event: { rank: number | null } | null }>("/api/score", {
        token: token.current,
        player: player.name,
        playerSecret: player.secret,
        score,
        stats,
      });
      setResult(
        r.ok
          ? { score, n: stats?.n ?? score, posted: true, best: r.data.best, rank: r.data.rank, badges: r.data.badges, eventRank: r.data.event?.rank ?? null }
          : { score, n: stats?.n ?? score, posted: false, error: r.data.error ?? "score not posted" },
      );
      setPhase("over");
      setBump((n) => n + 1);
    },
    [player],
  );

  // Space or Enter starts from the READY / GAME OVER overlay
  useEffect(() => {
    if (phase !== "ready" && phase !== "over") return;
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.tagName === "A")) return;
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        void start();
      }
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [phase, start]);

  const best = board?.you?.score ?? null;
  const rank = board?.you?.rank ?? null;
  const line = game.gameOver.replace("{n}", String(result?.n ?? live));

  return (
    <div style={{ "--accent": game.accent } as CSSProperties} className="mx-auto max-w-6xl px-4 py-6">
      <AccentStyle accent={game.accent} />
      {room && (
        <div className="card mb-4 flex flex-wrap items-center gap-3 border-accent p-3 text-sm">
          <span className="mono text-accent">ROOM {room}</span>
          <span className="text-muted">Runs here also count on the event board while the event is live.</span>
          <button className="ml-auto text-muted underline-offset-4 hover:text-text hover:underline" onClick={() => setRoom(null)}>
            Play without the room
          </button>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <span className="dot h-3 w-3" />
          {game.title}
        </h1>
        <span className="mono text-sm text-muted">
          best <span className="text-text">{best === null ? "--" : best.toLocaleString("en-US")}</span>
        </span>
        <span className="mono text-sm text-muted">
          season rank <span className="text-text">{rank === null ? "--" : `#${rank}`}</span>
        </span>
        <span className="mono ml-auto text-sm text-accent" aria-live="off">
          {String(Math.floor(live)).padStart(5, "0")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,800px)_1fr]">
        <div className="space-y-4">
          <div className="card relative overflow-hidden">
            {Comp && phase !== "ready" && (
              <Comp key={run} running={phase === "running"} accent={game.accent} onScore={setLive} onGameOver={over} />
            )}
            {phase === "ready" && <div className="aspect-[16/10] w-full bg-bg" />}
            {(phase === "ready" || phase === "starting" || phase === "posting" || phase === "over") && (
              <div className="absolute inset-0 grid place-items-center bg-bg/80 p-4 backdrop-blur-[2px]">
                {player === null ? (
                  <div className="w-full max-w-md">
                    <NicknameGate why="Claim a nickname to play and post scores." />
                  </div>
                ) : phase === "over" && result ? (
                  <div className="w-full max-w-sm space-y-3 text-center" role="status">
                    <p className="mono text-xs uppercase tracking-widest text-danger">game over</p>
                    <p className="text-muted">{line}</p>
                    <p className="mono text-5xl font-semibold text-accent">{result.score.toLocaleString("en-US")}</p>
                    {result.posted ? (
                      <p className="mono text-sm text-muted">
                        best {result.best?.toLocaleString("en-US") ?? "--"} · season rank {result.rank ? `#${result.rank}` : "--"}
                      </p>
                    ) : (
                      <p className="text-sm text-danger">Score not posted: {result.error}.</p>
                    )}
                    {result.eventRank ? <p className="mono text-sm text-accent">event rank #{result.eventRank}</p> : null}
                    {!!result.badges?.length && <p className="mono text-xs text-accent">badge earned: {result.badges.join(", ")}</p>}
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      <button className="btn btn-primary" onClick={() => void start()} autoFocus>
                        Play again
                      </button>
                      <ShareButton game={game} score={result.score} name={player?.name ?? ""} />
                    </div>
                  </div>
                ) : phase === "posting" ? (
                  <p className="mono deliberating text-sm uppercase text-accent">validators are deliberating</p>
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="mono text-xs uppercase tracking-widest text-muted">ready</p>
                    <button className="btn btn-primary min-w-40" onClick={() => void start()} disabled={phase === "starting" || !player}>
                      {phase === "starting" ? "Starting" : "Start"}
                    </button>
                    <p className="text-xs text-muted">or press Space</p>
                  </div>
                )}
                {error && <p className="absolute bottom-3 left-0 right-0 text-center text-sm text-danger">{error}</p>}
              </div>
            )}
          </div>
          {phase === "over" && <ConceptCard game={game} />}
          <div className="card p-4">
            <h2 className="mb-2 font-semibold">How to play</h2>
            <ul className="space-y-1 text-sm text-muted">
              {game.controls.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <Leaderboard game={game.slug} bump={bump} />
          <Link href={`/leaderboard?game=${game.slug}`} className="text-sm text-muted hover:text-text">
            All boards
          </Link>
        </div>
      </div>
    </div>
  );
}

function ShareButton({ game, score, name }: { game: Game; score: number; name: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${location.origin}/s/${game.slug}/${score}/${encodeURIComponent(name)}`;
    const text = `${score.toLocaleString("en-US")} in ${game.title} on GenLayer Arcade`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the share sheet was dismissed */
    }
  }
  return (
    <button className="btn btn-ghost" onClick={() => void share()}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
