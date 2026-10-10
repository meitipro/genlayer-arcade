"use client";
// Shown only on your own profile: the device secret, to use the nickname on another device.
import { useState } from "react";
import { savePlayer, usePlayer } from "@/lib/client/player";

export function DeviceSecret({ name }: { name: string }) {
  const p = usePlayer();
  const [shown, setShown] = useState(false);
  if (!p || p.name.toLowerCase() !== name.toLowerCase()) return null;
  return (
    <div className="card max-w-xl space-y-2 p-4 text-sm">
      <p className="font-semibold">This is you on this device</p>
      <p className="text-muted">Your nickname is tied to a secret stored in this browser. To play as {p.name} on another device, copy it there. Anyone with the secret can post as you.</p>
      {shown ? <p className="mono break-all rounded-[10px] bg-bg p-2 text-xs">{p.secret}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" onClick={() => setShown(!shown)}>
          {shown ? "Hide secret" : "Show secret"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (confirm("Forget this nickname on this device? You can only get it back with the secret.")) savePlayer(null);
          }}
        >
          Sign out on this device
        </button>
      </div>
    </div>
  );
}
