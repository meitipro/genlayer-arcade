"use client";
// The card picture for Download and Share: drawn from the card as it is on the
// page (the same element, styles, artwork and portrait), not from a second
// layout, so what the player saves or posts is the card they are looking at.
import { domToBlob } from "modern-screenshot";
import { FONTS_CSS } from "@/lib/fonts";

/** Card faces only use these; the rest of the site's fonts stay out of the picture. */
const CARD_FONTS = /^(Instrument Serif|Geist|JetBrains Mono|Inter)$/;
/** The card is 440px wide on the page; three times that is a crisp 1320px picture. */
const SCALE = 3;

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

let fontCss: Promise<string> | null = null;

/**
 * The card's @font-face rules with the font files inlined. The picture is an
 * SVG drawn into a canvas, which cannot load fonts from another site, and the
 * page's own font stylesheet is cross-site so its rules cannot be read. Latin
 * faces only. Empty when the fonts cannot be had: the picture then falls back
 * to system fonts rather than failing.
 */
function cardFontCss(): Promise<string> {
  fontCss ??= (async () => {
    try {
      const css = await (await fetch(FONTS_CSS)).text();
      const faces = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/).filter((block) => /^\/\*\s*latin\s*\*\//.test(block));
      const kept = faces.filter((f) => CARD_FONTS.test(/font-family:\s*'([^']+)'/.exec(f)?.[1] ?? ""));
      const inlined = await Promise.all(
        kept.map(async (face) => {
          const url = /url\(([^)]+)\)/.exec(face)?.[1];
          if (!url) return "";
          const data = await toDataUrl(await (await fetch(url)).blob());
          return face.replace(url, data);
        }),
      );
      return inlined.join("\n");
    } catch {
      fontCss = null;
      return "";
    }
  })();
  return fontCss;
}

/** Discord and X portraits come through this site, since a canvas refuses a cross-site image. */
async function viaSite(url: string): Promise<string | false> {
  if (!/^https:\/\/(cdn\.discordapp\.com|pbs\.twimg\.com)\//.test(url)) return false;
  const r = await fetch(`/api/avatar?u=${encodeURIComponent(url)}`);
  if (!r.ok) return false;
  return toDataUrl(await r.blob());
}

/** A PNG of the card face `el`, at three times its size on the page, flat (no tilt or glare). */
export async function cardPicture(el: HTMLElement): Promise<Blob> {
  const cssText = await cardFontCss();
  return domToBlob(el, {
    scale: SCALE,
    width: el.offsetWidth,
    height: el.offsetHeight,
    type: "image/png",
    // the face sits in a 3D flipper on the page; the picture is the face alone, square on
    style: { position: "relative", inset: "auto", transform: "none", backfaceVisibility: "visible", boxShadow: "none" },
    // the pointer glare is a reflection, not part of the card
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains("holo")),
    font: cssText ? { cssText } : undefined,
    fetchFn: viaSite,
  });
}
