'use client';
import { useEffect, useState } from 'react';
import type { Step } from '@/lib/chain';

/** /p/42 or /p/42/record, or ?id=42 when the dev server has no rewrite. */
export function pageIdFromLocation(): number | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/\/p\/(\d+)/);
  const q = new URLSearchParams(window.location.search).get('id');
  const raw = m?.[1] ?? q;
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

const STEP_TEXT: Record<Step, string> = {
  JOINING: 'WAITING TO JOIN',
  SEALING: 'WRITING',
  OPENING: 'OPENING',
  CHECKING: 'READY TO CHECK',
  SIGNING: 'SIGNING',
  AGREED: 'AGREED',
  NOT_AGREED: 'NOT AGREED',
  NO_SHOW: 'NO SHOW',
};

export function StepBadge({ step }: { step: Step }) {
  const cls = step === 'AGREED' ? 'verdict-AGREED' : step === 'NO_SHOW' ? 'verdict-NO_SHOW' : step === 'NOT_AGREED' ? 'verdict-NOT_AGREED' : 'verdict-GAPS';
  return <span className={`verdict ${cls}`} style={{ height: 24, fontSize: 11.5 }}>{STEP_TEXT[step]}</span>;
}

export function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(t);
  }, []);
  const left = until - now;
  const when = new Date(until * 1000).toUTCString().replace(':00 GMT', ' UTC');
  if (left <= 0) return <span>Closed at {when}. Anyone may settle it.</span>;
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  return <span>Closes in {h > 0 ? `${h} h ` : ''}{m} min <span className="faint">({when})</span></span>;
}

export function when(seconds: number): string {
  if (!seconds) return '';
  return new Date(seconds * 1000).toUTCString().slice(5, 22) + ' UTC';
}
