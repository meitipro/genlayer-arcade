"use client";
import { useEffect, useState } from "react";

/** Counts down to an ISO time. Renders "closed" once it has passed. */
export function Countdown({ to, prefix = "", done = "closed" }: { to: string; prefix?: string; done?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className="mono">{prefix}--:--:--</span>;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="mono">{done}</span>;
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className="mono" suppressHydrationWarning>
      {prefix}
      {hh}:{mm}:{ss}
    </span>
  );
}

/** Next occurrence of HH:00 UTC. */
export function nextUtc(hour: number, from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour));
  if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
