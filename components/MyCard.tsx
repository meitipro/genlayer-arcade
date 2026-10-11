"use client";
// My Card. The player is their Discord account, so the card is always there:
// roles from the GenLayer server, the tier they give, arcade standing. Linking
// an X account is optional and is proven with a code in the bio.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PlayerCard } from "@/lib/cardTypes";
import { loginUrl, postJson, signOut, usePlayer } from "@/lib/client/player";
import CredentialCard from "./CredentialCard";

export function MyCard() {
  const player = usePlayer();
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [flip, setFlip] = useState(0);

  const load = useCallback(async () => {
    if (!player) return;
    const r = await fetch(`/api/card/${encodeURIComponent(player.name)}`, { cache: "no-store" });
    if (r.ok) setCard(await r.json());
  }, [player]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!player || !card) return <div className="card h-64 animate-pulse" aria-busy />;

  return (
    <div className="space-y-8">
      <section aria-label="Your card">
        <div className="vault-cardstage">
          <CredentialCard data={card} hideFlipButton flipSignal={flip} />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button className="btn btn-primary" onClick={() => setFlip((n) => n + 1)}>
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
        <p className="mx-auto mt-4 max-w-xl text-center text-xs text-muted">
          Your roles are read from the GenLayer Discord server each time you sign in (scopes: identify, guilds.members.read). Nothing is posted and the access token is not kept. Refresh roles signs in again to read them again.
          {card.discord && !card.discord.isMember && " This Discord account is not in the GenLayer server, so the card shows no roles. Join at discord.gg/genlayerlabs, then refresh."}
        </p>
      </section>

      <XLink linked={card.x?.handle} enabled={card.config.x} onDone={load} />
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
