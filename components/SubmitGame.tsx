"use client";
// Submit a community game: the GameReview contract opens the link itself and
// the validators agree whether it is a game you can play on that page.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson, usePlayer } from "@/lib/client/player";
import { txUrl } from "@/lib/explorer";
import { SignInGate } from "./NicknameGate";
import { isDecided, isSuccess, TxStatus, useTx } from "./TxStatus";

const KEY = "arcade.community.pending";

export function SubmitGame() {
  const player = usePlayer();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [since, setSince] = useState(Date.now());
  const tx = useTx("community", hash);

  // a reload during a pending review resumes polling
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved?.hash) {
        setHash(saved.hash);
        setSince(saved.since ?? Date.now());
      }
    } catch {
      /* nothing saved */
    }
  }, []);

  useEffect(() => {
    if (isDecided(tx)) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      if (isSuccess(tx)) router.refresh();
    }
  }, [tx, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!player) return;
    setError("");
    setBusy(true);
    const r = await postJson<{ hash: string }>("/api/community/submit", { title, url });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "not sent, try again in a minute");
    const now = Date.now();
    setSince(now);
    setHash(r.data.hash);
    try {
      localStorage.setItem(KEY, JSON.stringify({ hash: r.data.hash, since: now }));
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="submit-game">
      <h2 id="submit-game" className="text-xl font-semibold">
        Submit a game
      </h2>
      <p className="max-w-2xl text-sm text-muted">
        Built a browser game? Send its link. An Intelligent Contract opens the page itself, an LLM decides whether it is a game you can play right there, and every validator opens it and decides again.
        Games judged PLAYABLE are listed here.
      </p>
      {player === null ? (
        <SignInGate why="Sign in with Discord to submit a game." />
      ) : hash && !isDecided(tx) ? (
        <TxStatus state={tx} since={since} explorer={txUrl(hash)} />
      ) : (
        <>
          {hash && isDecided(tx) && (
            <div className="space-y-2">
              <TxStatus state={tx} since={since} explorer={txUrl(hash)} />
              {isSuccess(tx) ? (
                <p className="text-sm">The review is on-chain. Its verdict is in the list below.</p>
              ) : (
                <p className="text-sm text-danger">
                  {tx?.status === "UNDETERMINED" ? "The validators could not agree, so nothing was recorded. You can submit the link again." : `Refused: ${tx?.error ?? tx?.status}.`}
                </p>
              )}
            </div>
          )}
          <form onSubmit={submit} className="card grid gap-3 p-5 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <label>
              <span className="text-sm text-muted">Title</span>
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} required minLength={3} maxLength={60} />
            </label>
            <label>
              <span className="text-sm text-muted">Link to the playable page (https)</span>
              <input className="field mono" type="url" value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://..." required />
            </label>
            <button className="btn btn-primary" disabled={busy || title.trim().length < 3 || !url.startsWith("https://")}>
              {busy ? "Sending" : "Submit for review"}
            </button>
            {error && (
              <p className="text-sm text-danger sm:col-span-3" role="alert">
                {error}
              </p>
            )}
          </form>
        </>
      )}
    </section>
  );
}
