// lib/cardSvg.ts: the card's engraved artwork. Ported unchanged from
// meitipro/genlayer-cards (lib/svg.ts): a deterministic guilloche drawn from a
// seed, and the notary seal. Same seed, same card, every time.
//
// Only the seal's ring text differs from the original: it names this hub.

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number) {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function rngFrom(s: string) {
  const seed = xmur3(s.toLowerCase() + "::genlayer");
  return sfc32(seed(), seed(), seed(), seed());
}

function rosette(cx: number, cy: number, a: number, b: number, petals: number, phase: number) {
  let d = "";
  let first = true;
  for (let t = 0; t <= Math.PI * 2 + 0.04; t += 0.04) {
    const x = cx + a * Math.cos(t) + b * Math.cos((petals - 1) * t + phase);
    const y = cy + a * Math.sin(t) - b * Math.sin((petals - 1) * t + phase);
    d += (first ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
    first = false;
  }
  return d;
}

function waveBand(y0: number, w: number, amp: number, freq: number, lines: number, gap: number, phase: number) {
  let d = "";
  for (let i = 0; i < lines; i++) {
    const yo = y0 + i * gap;
    let first = true;
    for (let x = 0; x <= w; x += 6) {
      const y = yo + amp * Math.sin(x * freq + phase + i * 0.5) + amp * 0.4 * Math.sin(x * freq * 2.3 + phase);
      d += (first ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
      first = false;
    }
  }
  return d;
}

export function guillocheSVG(seed: string) {
  const rng = rngFrom(seed + "-g");
  const p1 = rosette(820, 110, 68 + rng() * 20, 32 + rng() * 16, 7 + Math.floor(rng() * 4), rng() * 6);
  const p2 = rosette(820, 110, 44 + rng() * 14, 21 + rng() * 10, 9 + Math.floor(rng() * 4), rng() * 6);
  const p3 = rosette(150, 500, 58 + rng() * 18, 29 + rng() * 12, 6 + Math.floor(rng() * 3), rng() * 6);
  const band = waveBand(560, 1000, 7, 0.05 + rng() * 0.02, 7, 5, rng() * 6);
  return `<svg class="guilloche" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice">
    <g fill="none" stroke="var(--seal)" stroke-width="0.6" opacity="0.10"><path d="${p1}"/><path d="${p2}"/></g>
    <g fill="none" stroke="var(--bone)" stroke-width="0.5" opacity="0.05"><path d="${p3}"/></g>
    <g fill="none" stroke="var(--gilt)" stroke-width="0.45" opacity="0.10"><path d="${band}"/></g>
    <circle cx="820" cy="110" r="90" fill="none" stroke="var(--seal)" stroke-width="0.5" opacity="0.10"/></svg>`;
}

export function sealSVG() {
  const color = "var(--gilt)";
  let ring = "";
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = 50 + Math.cos(a) * 30;
    const y = 50 + Math.sin(a) * 30;
    const r = i % 3 === 0 ? 2 : 1.2;
    ring += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" opacity="${i % 3 === 0 ? "0.9" : "0.5"}"/>`;
  }
  let ticks = "";
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * Math.PI * 2;
    const x1 = 50 + Math.cos(a) * 44;
    const y1 = 50 + Math.sin(a) * 44;
    const x2 = 50 + Math.cos(a) * (k % 5 === 0 ? 40 : 42);
    const y2 = 50 + Math.sin(a) * (k % 5 === 0 ? 40 : 42);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="0.5" opacity="0.4"/>`;
  }
  return `<svg viewBox="0 0 100 100"><defs><path id="sr" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"/></defs>
    <circle cx="50" cy="50" r="47" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.7"/>
    <circle cx="50" cy="50" r="34" fill="none" stroke="${color}" stroke-width="0.6" opacity="0.5"/>${ticks}
    <text class="rt"><textPath href="#sr" startOffset="0">• GENLAYER ARCADE • COMMUNITY CARD • </textPath></text>${ring}
    <circle cx="50" cy="50" r="7" fill="none" stroke="${color}" stroke-width="1" opacity="0.9"/>
    <path d="M50 44 L56 50 L50 56 L44 50 Z" fill="${color}" opacity="0.85"/></svg>`;
}
