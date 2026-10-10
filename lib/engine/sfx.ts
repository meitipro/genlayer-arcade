// lib/engine/sfx.ts synthesized sounds, no audio files to load (section 9).
let ac: AudioContext | null = null;

function readMuted(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem("muted") === "1";
  } catch {
    return false;
  }
}

let muted = readMuted();
const listeners = new Set<(m: boolean) => void>();

export const isMuted = () => muted;
export const setMuted = (m: boolean) => {
  muted = m;
  try {
    localStorage.setItem("muted", m ? "1" : "0");
  } catch {
    /* storage blocked: mute still holds for this page */
  }
  listeners.forEach((fn) => fn(m));
};
export const onMuted = (fn: (m: boolean) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ac ??= new AudioContext();
    if (ac.state === "suspended") void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.08, slideTo?: number, delay = 0) {
  if (muted) return;
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator(),
    g = a.createGain(),
    t = a.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

/** A short burst of filtered noise (the Validator Run hit). */
function noise(dur: number, vol = 0.12) {
  if (muted) return;
  const a = ctx();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(),
    g = a.createGain(),
    f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1200;
  src.buffer = buf;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  jump: () => tone(440, 0.06),
  pickup: () => tone(880, 0.12, "triangle", 0.08, 1320),
  hit: () => {
    noise(0.25);
    tone(140, 0.25, "sawtooth", 0.06, 60);
  },
  combo: (n: number) => tone(500 + n * 60, 0.07, "triangle"),
  perfect: (n: number) => tone(660 * Math.pow(1.06, n), 0.15, "sine", 0.1),
  fail: () => tone(400, 0.5, "sine", 0.1, 90),
  chord: () => {
    tone(523, 0.3, "triangle");
    tone(659, 0.3, "triangle");
    tone(784, 0.3, "triangle");
  },
  thud: () => tone(120, 0.12, "sine", 0.14, 70),
  click: () => tone(1500, 0.03, "square", 0.03),
  buzz: () => tone(90, 0.3, "sawtooth", 0.09, 70),
  whoosh: () => tone(300, 0.09, "sine", 0.05, 900),
  match: () => {
    tone(660, 0.12, "triangle", 0.08);
    tone(990, 0.16, "triangle", 0.08, undefined, 0.1);
  },
  mismatch: () => tone(160, 0.14, "sine", 0.08, 120),
  pop: () => tone(700, 0.06, "square", 0.05, 1100),
  arpeggio: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "triangle", 0.07, undefined, i * 0.07)),
  crash: () => {
    noise(0.35, 0.14);
    tone(220, 0.4, "sawtooth", 0.06, 55);
  },
  bounce: () => tone(330, 0.04, "square", 0.04),
  tick: () => tone(1100, 0.03, "triangle", 0.05),
  lost: () => tone(180, 0.4, "sine", 0.1, 80),
};
