"use client";
import { useEffect, useState } from "react";
import { isMuted, onMuted, setMuted } from "@/lib/engine/sfx";

export function MuteToggle() {
  const [m, setM] = useState(false);
  useEffect(() => {
    setM(isMuted());
    return onMuted(setM);
  }, []);
  return (
    <button
      type="button"
      onClick={() => setMuted(!m)}
      aria-pressed={m}
      aria-label={m ? "Unmute sound" : "Mute sound"}
      className="grid h-11 w-11 place-items-center rounded-[10px] border border-line text-muted hover:text-text"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
        {m ? <path d="M17 9l5 6M22 9l-5 6" strokeLinecap="round" /> : <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
