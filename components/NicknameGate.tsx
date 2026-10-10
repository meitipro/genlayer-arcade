"use client";
// Claim a nickname with a device secret, no wallet (section 8). The secret is
// returned once and kept in this browser; "Use on another device" restores it.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { postJson, savePlayer, usePlayer } from "@/lib/client/player";

export function NicknameGate({ children, why = "Claim a nickname to post scores." }: { children?: ReactNode; why?: string }) {
  const p = usePlayer();
  if (p === undefined) return <div className="card h-40 animate-pulse" aria-busy />;
  if (p) return <>{children}</>;
  return <ClaimForm why={why} />;
}

export function ClaimForm({ why }: { why?: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restore, setRestore] = useState(false);
  const [secret, setSecret] = useState("");

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (restore) {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(name) || !/^[0-9a-f]{64}$/.test(secret.trim())) {
        setError("enter your nickname and the 64-character secret from your other device");
        return;
      }
      savePlayer({ name, secret: secret.trim() });
      return;
    }
    setBusy(true);
    const r = await postJson<{ name: string; secret: string }>("/api/player/claim", { name });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "could not claim that name, try again");
    savePlayer({ name: r.data.name, secret: r.data.secret });
  }

  return (
    <form onSubmit={claim} className="card space-y-3 p-5">
      <h2 className="text-lg font-semibold">{restore ? "Use your nickname on this device" : "Claim a nickname"}</h2>
      <p className="text-sm text-muted">
        {restore
          ? "Paste the secret shown on your profile page on the other device."
          : `${why} No wallet needed: the name is tied to a secret stored in this browser.`}
      </p>
      <label className="block">
        <span className="sr-only">Nickname</span>
        <input
          className="field mono"
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
          placeholder="nickname (3 to 20, letters, digits, _)"
          autoComplete="off"
          required
          minLength={3}
          maxLength={20}
        />
      </label>
      {restore && (
        <label className="block">
          <span className="sr-only">Device secret</span>
          <input className="field mono" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="64-character secret" autoComplete="off" />
        </label>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={busy || name.length < 3}>
          {busy ? "Claiming" : restore ? "Use this nickname" : "Claim nickname"}
        </button>
        <button type="button" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline" onClick={() => (setRestore(!restore), setError(""))}>
          {restore ? "Claim a new nickname instead" : "Use a nickname from another device"}
        </button>
      </div>
    </form>
  );
}

export function NicknamePill() {
  const p = usePlayer();
  if (!p) return null;
  return (
    <Link href={`/p/${p.name}`} className="pill mono max-w-[9rem] truncate hover:border-accent" title="Your profile">
      <span className="dot" />
      <span className="truncate">{p.name}</span>
    </Link>
  );
}
