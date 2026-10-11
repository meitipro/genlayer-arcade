"use client";
// My Card. The player is their Discord account, so the card is always there:
// roles from the GenLayer server, the tier they give, arcade standing. Linking
// an X account is optional and is proven with a code in the bio.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerCard } from "@/lib/cardTypes";
import { loginUrl, postJson, signOut, usePlayer } from "@/lib/client/player";
import { shareParts } from "@/lib/cardShare";
import CredentialCard from "./CredentialCard";

export function MyCard() {
  const player = usePlayer();
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [flip, setFlip] = useState(0);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!player) return;
    const r = await fetch(`/api/card/${encodeURIComponent(player.name)}`, { cache: "no-store" });
    if (r.ok) setCard(await r.json());
  }, [player]);

  useEffect(() => {
    void load();
  }, [load]);

  // the server level and XP come from MEE6; read them once per visit when they are missing or old
  const asked = useRef(false);
  useEffect(() => {
    if (!card || asked.current || !card.discord) return;
    if (card.server && Date.now() - card.server.at < 6 * 3600 * 1000) return;
    asked.current = true;
    void postJson("/api/mee6/refresh", {}).then((r) => {
      if (r.ok && (r.data as { read?: boolean }).read) void load();
    });
  }, [card, load]);

  if (!player || !card) return <div className="card h-64 animate-pulse" aria-busy />;

  return (
    <div className="space-y-8">
      <section aria-label="Your card">
        <div className="vault-cardstage">
          <CredentialCard data={card} hideFlipButton flipSignal={flip} />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button className="btn btn-primary" onClick={() => setSharing((v) => !v)} aria-expanded={sharing}>
            Share card
          </button>
          <button className="btn btn-ghost" onClick={() => setFlip((n) => n + 1)}>
            Flip
          </button>
          <a className="btn btn-ghost" href={loginUrl("/card")}>
            Refresh roles
          </a>
          <Link href={`/p/${player.name}`} className="btn btn-ghost">
            Public page
          </Link>
          <button className="btn btn-ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
        {sharing && <SharePanel card={card} />}
        <p className="mx-auto mt-4 max-w-xl text-center text-xs text-muted">
          Your roles are read from the GenLayer Discord server each time you sign in (scopes: identify, guilds.members.read). Nothing is posted and the access token is not kept. Refresh roles signs in again to read them again.
          {card.discord && !card.discord.isMember && " This Discord account is not in the GenLayer server, so the card shows no roles. Join at discord.gg/genlayerlabs, then refresh."}
        </p>
      </section>

      <XLink linked={card.x?.handle} enabled={card.config.x} onDone={load} />
    </div>
  );
}

function SharePanel({ card }: { card: PlayerCard }) {
  const [origin, setOrigin] = useState("");
  const [canNative, setCanNative] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    setOrigin(location.origin);
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // the version tag makes a link preview refetch the picture when the card changes
  const v = `${card.recordHash.slice(2, 10)}-${card.server?.xp ?? 0}-${card.xp}`;
  const image = `/api/og/card/${encodeURIComponent(card.name)}?v=${v}`;
  const url = `${origin}/s/card/${encodeURIComponent(card.name)}?v=${v}`;
  const { body, text } = shareParts(card, url);
  const flash = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(""), 2500);
  };

  async function nativeShare() {
    try {
      const blob = await fetch(image).then((r) => (r.ok ? r.blob() : null));
      const file = blob ? new File([blob], `genlayer-card-${card.name}.png`, { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title: `${card.name} on GenLayer Arcade` });
      else await navigator.share({ text, title: `${card.name} on GenLayer Arcade` });
    } catch {
      /* the share sheet was dismissed */
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      flash("Text copied");
    } catch {
      flash("Copy failed. Select the text and copy it.");
    }
  }
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(body)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="card mx-auto mt-6 max-w-2xl space-y-4 p-5" role="region" aria-label="Share your card">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated image */}
      <img src={image} alt={`Card of ${card.name}`} width={1200} height={630} className="h-auto w-full rounded-[12px] border border-white/10" />
      <textarea className="field mono h-40 w-full resize-none text-sm" readOnly value={text} aria-label="Text that goes with the card" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        {canNative && (
          <button className="btn btn-primary" onClick={() => void nativeShare()}>
            Share
          </button>
        )}
        <a className={`btn ${canNative ? "btn-ghost" : "btn-primary"}`} href={intent} target="_blank" rel="noopener noreferrer">
          Post on X
        </a>
        <button className="btn btn-ghost" onClick={() => void copy()}>
          Copy text
        </button>
        <a className="btn btn-ghost" href={image} download={`genlayer-card-${card.name}.png`}>
          Download image
        </a>
      </div>
      <p className="text-center text-xs text-muted" aria-live="polite">
        {note || "Posting to X shows the card picture from the link. To attach the picture yourself, download it first."}
      </p>
    </div>
  );
}

function XLink({ linked, enabled, onDone }: { linked?: string; enabled: boolean; onDone: () => void }) {
  const [handle, setHandle] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setMsg("");
    setBusy(true);
    const r = await postJson<{ code: string; instructions: string }>("/api/social/start", { network: "x", handle });
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error ?? "could not start");
    setCode(r.data.code);
    setMsg(r.data.instructions);
  }
  async function verify() {
    setBusy(true);
    const r = await postJson("/api/social/verify", { network: "x" });
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error ?? "not verified yet");
    setCode(null);
    setMsg("Verified. You can remove the code from your bio now.");
    onDone();
  }
  async function remove() {
    await postJson("/api/social/remove", { network: "x" });
    onDone();
  }

  return (
    <section className="card mx-auto max-w-xl space-y-3 p-5">
      <h2 className="font-semibold">
        X (Twitter) <span className="mono text-xs font-normal text-muted">optional</span>
      </h2>
      {!enabled ? (
        <p className="text-sm text-muted">X verification is not configured on this site yet.</p>
      ) : linked && !code ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="mono">@{linked}</span>
          <span className="mono text-xs text-accent">VERIFIED</span>
          <button className="ml-auto text-muted hover:text-text" onClick={() => void remove()}>
            Remove
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">Show your X account on your card. You get a short code to put in your bio or location, then press Verify. You can remove the code afterwards.</p>
          <div className="flex gap-2">
            <input className="field mono" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" aria-label="X handle" />
            {!code ? (
              <button className="btn btn-ghost" disabled={busy || !handle.trim()} onClick={() => void start()}>
                Get code
              </button>
            ) : (
              <button className="btn btn-primary" disabled={busy} onClick={() => void verify()}>
                Verify
              </button>
            )}
          </div>
          {code && <p className="mono rounded-[10px] bg-bg p-2 text-center text-lg text-accent">{code}</p>}
        </>
      )}
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </section>
  );
}
