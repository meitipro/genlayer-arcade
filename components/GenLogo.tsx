"use client";

// Official GenLayer mark, vectorized and tintable via `color` (uses currentColor).
// No background, transparent, scales crisply at any size.
export default function GenLogo({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  const svg = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" style="display:block"><g transform="translate(0.000000,400.000000) scale(0.100000,-0.100000)" fill="currentColor" stroke="none"><path d="M1018 1974 c-450 -934 -816 -1700 -813 -1702 5 -5 145 49 1030 398
281 111 523 207 539 212 28 11 17 17 -257 155 -158 79 -287 147 -287 151 0 5
57 127 126 273 69 145 148 309 174 364 26 55 106 224 179 376 l131 277 -2 596
-3 597 -817 -1697z M2182 3068 l3 -603 278 -580 c154 -319 291 -607 306 -640
l28 -60 -289 -145 -289 -146 258 -101 c402 -159 1306 -514 1330 -524 25 -9 19
4 -147 346 -51 105 -109 226 -130 270 -21 44 -76 159 -123 255 -93 192 -255
529 -527 1095 -98 204 -217 451 -265 550 -48 99 -107 221 -130 270 -24 50 -86
180 -140 290 -53 110 -110 228 -127 263 -16 34 -31 62 -34 62 -2 0 -3 -271 -2
-602z M1982 2008 c-11 -24 -87 -184 -170 -355 l-150 -313 170 -89 171 -89 166
82 c92 46 173 85 181 88 10 3 -36 102 -165 359 -97 195 -179 355 -180 357 -2
2 -12 -16 -23 -40z"/></g></svg>`.replace(/{S}/g, String(size));
  return (
    <span
      style={{ display: "inline-flex", color, width: size, height: size, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
