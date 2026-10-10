"use client";
// One play surface for the three daily on-chain games (section 11, shared daily UX):
// already played -> show the entry; submit -> TxStatus with elapsed time and an
// explorer link; UNDETERMINED -> explain and allow a retry; 503 -> keep the input.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { postJson, usePlayer } from "@/lib/client/player";
import { txUrl } from "@/lib/explorer";
import type { BridgeEntry, BridgeRound, OnchainGame, OracleRound, VerdictEntry, VerdictRound } from "@/lib/onchain";
import { nextUtc } from "@/lib/time";
import { Countdown } from "./Countdown";
import { NicknameGate } from "./NicknameGate";
import { isDecided, isSuccess, TxStatus, useTx } from "./TxStatus";

type Round = VerdictRound | BridgeRound | OracleRound;
type Entry = VerdictEntry | BridgeEntry | { player: string; guess: number };

export function DailyPlay({ game, round, title }: { game: OnchainGame; round: Round | null; title: string }) {
  const player = usePlayer();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [since, setSince] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [middle, setMiddle] = useState("");
  const [value, setValue] = useState("");
  const tx = useTx(game, hash);
  const router = useRouter();

  const open = round ? (game === "oracle" ? (round as OracleRound).state === "open" : (round as VerdictRound).open) : false;

  // already played (or a reload during a pending tx): show the entry or resume polling
  useEffect(() => {
    if (!player || !round) {
      setLoaded(true);
      return;
    }
    let stop = false;
    fetch(`/api/daily/${game}/entry?round=${round.id}&player=${encodeURIComponent(player.name)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (stop) return;
        if (d.entry) setEntry(d.entry);
        if (d.hash) setHash(d.hash);
        if (d.since) setSince(Date.parse(d.since));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      stop = true;
    };
  }, [game, round, player]);

  // once the tx is decided and returned, read the entry the contract stored
  useEffect(() => {
    if (!isSuccess(tx) || !player || !round || entry) return;
    let tries = 0;
    let stop = false;
    const load = async () => {
      const d = await fetch(`/api/daily/${game}/entry?round=${round.id}&player=${encodeURIComponent(player.name)}`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({}));
      if (stop) return;
      if (d.entry) {
        setEntry(d.entry);
        // the status route dropped this game's cache when the tx settled; re-render the board
        router.refresh();
      } else if (tries++ < 6) setTimeout(load, 3000);
    };
    void load();
    return () => {
      stop = true;
    };
  }, [tx, game, round, player, entry, router]);

  const failed = isDecided(tx) && !isSuccess(tx);
  const duplicate = /already (submitted|guessed)/.test(tx?.error ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!player || !round) return;
    setError("");
    const body: Record<string, unknown> = { player: player.name, playerSecret: player.secret, round: round.id };
    if (game === "verdict") body.entry = text;
    if (game === "bridge") {
      const r = round as BridgeRound;
      body.chain = [r.start, ...middle.toLowerCase().trim().split(/\s+/).filter(Boolean), r.end].join(" ");
    }
    if (game === "oracle") body.value = value;
    setBusy(true);
    const r = await postJson<{ hash: string }>(`/api/daily/${game}/submit`, body);
    setBusy(false);
    if (!r.ok) {
      // keep the input; say what happened and what to do
      setError(r.data.error ?? "not sent, try again in a minute");
      return;
    }
    setSince(Date.now());
    setHash(r.data.hash);
  }

  if (!round) {
    return (
      <div className="card p-5 text-muted">
        No round is open yet. New rounds open at 00:00 UTC.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RoundHeader game={game} round={round} />
      {player === null ? (
        <NicknameGate why={`Claim a nickname to play ${title}.`} />
      ) : !loaded ? (
        <div className="card h-32 animate-pulse" aria-busy />
      ) : entry ? (
        <>
          <EntryView game={game} round={round} entry={entry} />
          {hash && <TxStatus state={tx} since={since} explorer={txUrl(hash)} />}
          <Share game={game} round={round.id} />
        </>
      ) : hash && !failed ? (
        <>
          <TxStatus state={tx} since={since} explorer={txUrl(hash)} />
          {isSuccess(tx) && <p className="mono deliberating text-sm text-muted">READING YOUR RESULT FROM THE CONTRACT</p>}
        </>
      ) : !open ? (
        <div className="card p-5 text-muted">
          {game === "oracle" && (round as OracleRound).state === "locked"
            ? "Guessing is locked. The contract resolves this round from the live source shortly."
            : "This round is closed. The next one opens at 00:00 UTC."}
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-3 p-5">
          {failed && hash && (
            <div className="space-y-2 rounded-[10px] border border-danger/50 p-3 text-sm">
              {tx?.status === "UNDETERMINED" ? (
                <p>
                  <span className="mono text-danger">UNDETERMINED.</span> The validators could not agree on a result for your entry, so nothing was recorded. You can submit again.
                </p>
              ) : (
                <p>
                  <span className="mono text-danger">{tx?.status}.</span> The contract refused the entry: {tx?.error ?? "no reason given"}.
                  {duplicate ? " You already played this round." : " You can try again."}
                </p>
              )}
              <a className="mono text-xs text-accent" href={txUrl(hash)} target="_blank" rel="noreferrer">
                VIEW ON EXPLORER
              </a>
            </div>
          )}
          {game === "verdict" && (
            <>
              <label htmlFor="entry" className="text-sm text-muted">
                Your answer, up to 280 characters
              </label>
              <textarea id="entry" className="field min-h-28" maxLength={280} value={text} onChange={(e) => setText(e.target.value)} required />
              <p className="mono text-right text-xs text-muted">{text.trim().length}/280</p>
            </>
          )}
          {game === "bridge" && <BridgeInput round={round as BridgeRound} middle={middle} setMiddle={setMiddle} />}
          {game === "oracle" && (
            <>
              <label htmlFor="guess" className="text-sm text-muted">
                Your guess, a whole number in {(round as OracleRound).unit}
              </label>
              <input id="guess" className="field mono text-lg" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9-]/g, ""))} required />
            </>
          )}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy || duplicate}>
            {busy ? "Sending" : "Submit"}
          </button>
          <p className="text-xs text-muted">One entry per nickname per round. The hub pays the network fee, so you do not need a wallet.</p>
        </form>
      )}
    </div>
  );
}

function RoundHeader({ game, round }: { game: OnchainGame; round: Round }) {
  if (game === "verdict") {
    const r = round as VerdictRound;
    return (
      <div className="card space-y-2 p-5">
        <p className="mono text-xs uppercase text-muted">
          daily verdict round {r.id} · {r.players} players · {r.open ? <Countdown to={nextUtc(0)} prefix="closes in " /> : "closed"}
        </p>
        <h2 className="text-xl font-semibold">{r.challenge}</h2>
        {r.criteria && <p className="text-sm text-muted">Judged on: {r.criteria}</p>}
      </div>
    );
  }
  if (game === "bridge") {
    const r = round as BridgeRound;
    return (
      <div className="card space-y-3 p-5">
        <p className="mono text-xs uppercase text-muted">
          word bridge round {r.id} · {r.players} players · {r.open ? <Countdown to={nextUtc(0)} prefix="closes in " /> : "closed"}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Chip word={r.start} strong />
          <span className="text-muted">to</span>
          <Chip word={r.end} strong />
        </div>
        <p className="text-sm text-muted">Build the shortest chain of associated words between them. 100 points for one middle word, minus 15 per extra hop.</p>
      </div>
    );
  }
  const r = round as OracleRound;
  return (
    <div className="card space-y-2 p-5">
      <p className="mono text-xs uppercase text-muted">
        oracle guess #{r.id} · {r.players} players ·{" "}
        {r.state === "open" ? <Countdown to={nextUtc(18)} prefix="closes in " done="locking" /> : r.state.toUpperCase()}
      </p>
      <h2 className="text-xl font-semibold">{r.question}</h2>
      {r.state === "resolved" && r.answer !== null && (
        <p className="mono text-lg">
          answer <span className="text-accent">{r.answer} {r.unit}</span>
        </p>
      )}
      <p className="text-xs text-muted">
        Source, fetched by the contract itself at the deadline:{" "}
        <a href={r.url} target="_blank" rel="noreferrer" className="break-all underline-offset-4 hover:underline">
          {r.url}
        </a>{" "}
        ({r.path}). Validators must agree within 1%.
      </p>
    </div>
  );
}

function Chip({ word, strong, bad }: { word: string; strong?: boolean; bad?: boolean }) {
  return (
    <span
      className={`mono rounded-full border px-3 py-1 text-sm ${strong ? "border-accent text-text" : "border-line text-text"} ${bad ? "border-danger" : ""}`}
    >
      {word}
    </span>
  );
}

function BridgeInput({ round, middle, setMiddle }: { round: BridgeRound; middle: string; setMiddle: (s: string) => void }) {
  const words = middle.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return (
    <>
      <label htmlFor="middle" className="text-sm text-muted">
        Middle words, separated by spaces (1 to 5)
      </label>
      <input
        id="middle"
        className="field mono"
        value={middle}
        onChange={(e) => setMiddle(e.target.value.replace(/[^a-zA-Z ]/g, ""))}
        placeholder="one to five words"
        autoComplete="off"
        autoCapitalize="none"
        required
      />
      <div className="flex flex-wrap items-center gap-2" aria-label="Your chain">
        {[round.start, ...words, round.end].map((w, i, all) => (
          <span key={`${w}-${i}`} className="flex items-center gap-2">
            <Chip word={w} strong={i === 0 || i === all.length - 1} />
            {i < all.length - 1 && <span className="text-muted" aria-hidden>-</span>}
          </span>
        ))}
      </div>
      <p className="mono text-xs text-muted">
        {words.length} hop{words.length === 1 ? "" : "s"}, worth {words.length ? Math.max(0, 100 - 15 * (words.length - 1)) : 0} if every link holds
      </p>
    </>
  );
}

function EntryView({ game, round, entry }: { game: OnchainGame; round: Round; entry: Entry }) {
  if (game === "verdict") {
    const e = entry as VerdictEntry;
    return (
      <div className="card space-y-3 p-5">
        <p className="mono text-xs uppercase text-muted">your answer</p>
        <p className="leading-relaxed">{e.entry}</p>
        <p className="mono text-5xl font-semibold text-accent">
          {e.score}
          <span className="text-2xl text-muted">/10</span>
        </p>
        <p className="text-sm text-muted">{e.reason}</p>
      </div>
    );
  }
  if (game === "bridge") {
    const e = entry as BridgeEntry;
    return (
      <div className="card space-y-3 p-5">
        <p className="mono text-xs uppercase text-muted">your chain · {e.valid ? "valid" : "invalid"}</p>
        <div className="flex flex-wrap items-center gap-2">
          {e.chain.map((w, i) => (
            <span key={`${w}-${i}`} className="flex items-center gap-2">
              <Chip word={w} strong={i === 0 || i === e.chain.length - 1} />
              {i < e.chain.length - 1 && (
                <span className={`mono text-xs ${e.links[i] ? "text-accent" : "text-danger"}`}>{e.links[i] ? "ok" : "no link"}</span>
              )}
            </span>
          ))}
        </div>
        <p className="mono text-5xl font-semibold text-accent">{e.score}</p>
        <p className="text-sm text-muted">Every link was judged by an LLM, and every judgement was re-checked by validators.</p>
      </div>
    );
  }
  const g = (entry as { guess: number }).guess;
  const r = round as OracleRound;
  return (
    <div className="card space-y-2 p-5">
      <p className="mono text-xs uppercase text-muted">your guess</p>
      <p className="mono text-4xl font-semibold text-accent">
        {g} <span className="text-lg text-muted">{r.unit}</span>
      </p>
      {r.state === "resolved" && r.answer !== null ? (
        <p className="mono text-sm">
          answer {r.answer} {r.unit} · off by {Math.abs(g - r.answer)}
        </p>
      ) : (
        <p className="text-sm text-muted">Locked in. The contract resolves the round at 18:00 UTC from the live source.</p>
      )}
    </div>
  );
}

function Share({ game, round }: { game: OnchainGame; round: string }) {
  const [copied, setCopied] = useState(false);
  const path = useMemo(() => `/daily/${game}/${round}`, [game, round]);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="btn btn-ghost"
        onClick={async () => {
          const url = `${location.origin}${path}`;
          try {
            if (navigator.share) await navigator.share({ url, title: "GenLayer Arcade daily" });
            else {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          } catch {
            /* dismissed */
          }
        }}
      >
        {copied ? "Link copied" : "Share"}
      </button>
      <Link href={path} className="btn btn-ghost">
        Round board
      </Link>
    </div>
  );
}
