"use client";
// My Card: connect Discord (roles from the GenLayer server), verify X and
// GitHub with a bio code, and see the card others see on /p/<name>.
// The empty state and the actions mirror meitipro/genlayer-cards.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PlayerCard } from "@/lib/cardTypes";
import { postJson, usePlayer } from "@/lib/client/player";
import CredentialCard from "./CredentialCard";
import { NicknameGate } from "./NicknameGate";

const OUTCOMES: Record<string, string> = {
  ok: "Discord connected. Your GenLayer server roles are on your card.",
  "not-member": "Discord connected, but this account is not in the GenLayer Discord server, so no roles were found. Join at discord.gg/genlayerlabs, then connect again.",
  taken: "That Discord account is already connected to another nickname. One Discord account plays under one nickname.",
  cancelled: "Discord connect was cancelled.",
  expired: "That Discord connect link expired. Start again.",
  failed: "Discord did not answer as expected. Try again in a minute.",
  "bad-request": "Discord sent back an incomplete answer. Start again.",
};

/** What a card looks like, for someone who has not connected Discord yet. Labelled as a preview where it is shown. */
function sample(name: string): PlayerCard {
  return {
    name,
    since: null,
    level: 3,
    xp: 540,
    badges: 2,
    dailies: 4,
    best: null,
    discord: {
      id: "preview",
      username: "your_discord",
      avatar: null,
      isMember: true,
      highestRole: "Synapse",
      roles: ["Synapse", "Molecule", "Mindbender"],
      joinedAt: "2025-03-01T00:00:00Z",
      connectedAt: "2026-01-01T00:00:00Z",
    },
    x: null,
    github: null,
    wallet: null,
    config: { discord: true, x: false },
    tier: { n: "II", name: "Ember" },
    standing: "Synapse",
    credentialNo: "0000-0000",
    recordHash: "0x" + "0".repeat(40),
    seed: `preview#${name}`,
  };
}

export function MyCard() {
  const player = usePlayer();
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [flip, setFlip] = useState(0);

  const load = useCallback(async () => {
    if (!player) return;
    const r = await fetch(`/api/card/${encodeURIComponent(player.name)}`, { cache: "no-store" });
    if (r.ok) setCard(await r.json());
    setLoaded(true);
  }, [player]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const o = new URLSearchParams(window.location.search).get("discord");
    if (o && OUTCOMES[o]) setNotice(OUTCOMES[o]);
  }, []);

  if (player === undefined) return <div className="card h-64 animate-pulse" aria-busy />;
  if (player === null) return <NicknameGate why="Claim a nickname first, then connect Discord to build your card." />;

  async function connect() {
    setError("");
    setBusy(true);
    const r = await postJson<{ url: string }>("/api/discord/start", { player: player!.name, playerSecret: player!.secret });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "could not start Discord connect");
    window.location.href = r.data.url;
  }

  async function disconnect() {
    if (!confirm("Disconnect Discord from this nickname?")) return;
    await postJson("/api/discord/disconnect", { player: player!.name, playerSecret: player!.secret });
    void load();
  }

  return (
    <div className="space-y-8">
      {notice && (
        <p className="card p-4 text-sm" role="status">
          {notice}
        </p>
      )}

      {card?.discord ? (
        <section aria-label="Your card">
          <div className="vault-cardstage">
            <CredentialCard data={card} hideFlipButton flipSignal={flip} />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button className="btn btn-primary" onClick={() => setFlip((n) => n + 1)}>
              Flip
            </button>
            {card.config.discord && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => void connect()}>
                Refresh roles
              </button>
            )}
            <Link href={`/p/${player.name}`} className="btn btn-ghost">
              Public page
            </Link>
            <button className="btn btn-ghost" onClick={() => void disconnect()}>
              Disconnect Discord
            </button>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-xs text-muted">
            Roles are read from the GenLayer Discord server when you connect (scopes: identify, guilds.members.read). Nothing is posted and the access token is not kept. Refresh roles reads them again.
          </p>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 py-10 text-center" aria-label="Your card">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
            <path d="M22 3l16 9v20L22 41 6 32V12z" stroke="var(--accent)" strokeWidth="1.5" opacity=".7" />
          </svg>
          <h2 className="text-xl font-semibold">Your card appears here</h2>
          <p className="max-w-sm text-sm text-muted">Connect Discord and build your card. It shows up right here, with your GenLayer server roles and your tier.</p>
          {!loaded ? (
            <div className="h-11" />
          ) : card && !card.config.discord ? (
            <p className="text-sm text-danger">Discord connect is not configured on this site yet.</p>
          ) : (
            <button className="btn btn-primary" disabled={busy} onClick={() => void connect()}>
              Get your card
            </button>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="mt-8 w-full">
            <p className="mono mb-1 text-xs uppercase tracking-widest text-muted">preview, not a real record</p>
            <div className="vault-cardstage">
              <CredentialCard data={sample(player.name)} />
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SocialLink network="x" label="X (Twitter)" enabled={card?.config.x ?? false} linked={card?.x?.handle} onDone={load} />
        <SocialLink network="github" label="GitHub" enabled linked={card?.github?.handle} onDone={load} />
      </div>
    </div>
  );
}

function SocialLink({ network, label, enabled, linked, onDone }: { network: "x" | "github"; label: string; enabled: boolean; linked?: string; onDone: () => void }) {
  const player = usePlayer();
  const [handle, setHandle] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!player) return null;

  async function start() {
    setMsg("");
    setBusy(true);
    const r = await postJson<{ code: string; instructions: string }>("/api/social/start", { player: player!.name, playerSecret: player!.secret, network, handle });
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error ?? "could not start");
    setCode(r.data.code);
    setMsg(r.data.instructions);
  }
  async function verify() {
    setBusy(true);
    const r = await postJson("/api/social/verify", { player: player!.name, playerSecret: player!.secret, network });
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error ?? "not verified yet");
    setCode(null);
    setMsg("Verified. You can remove the code from your bio now.");
    onDone();
  }
  async function remove() {
    await postJson("/api/social/remove", { player: player!.name, playerSecret: player!.secret, network });
    onDone();
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">{label}</h2>
      {!enabled ? (
        <p className="text-sm text-muted">{label} verification is not configured on this site yet.</p>
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
          <p className="text-sm text-muted">Prove the handle is yours: you get a short code to put in your {network === "x" ? "bio or location" : "profile bio"}, then press Verify.</p>
          <div className="flex gap-2">
            <input className="field mono" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={network === "x" ? "@handle" : "username"} aria-label={`${label} handle`} />
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
