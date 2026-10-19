/**
 * Fails the build on a broken internal link: every href="/..." in the exported
 * HTML must resolve to a file in out/, after the rewrites vercel.json applies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
const pages = [];
for (const f of fs.readdirSync(OUT, { recursive: true })) if (String(f).endsWith('.html')) pages.push(String(f));

const resolves = (url) => {
  const clean = decodeURI(url.split('#')[0].split('?')[0]).replace(/\/$/, '');
  if (clean === '' || clean === '/') return fs.existsSync(path.join(OUT, 'index.html'));
  if (/^\/p\/\d+(\/record)?$/.test(clean)) return true; // rewritten to /p and /record by vercel.json
  const rel = clean.slice(1);
  return [rel, `${rel}.html`, path.join(rel, 'index.html')].some((c) => fs.existsSync(path.join(OUT, c)));
};

const broken = [];
for (const file of pages) {
  const html = fs.readFileSync(path.join(OUT, file), 'utf8');
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    const url = m[1].replace(/&amp;/g, '&');
    if (url.startsWith('//') || url.startsWith('/_next/')) continue;
    if (!resolves(url)) broken.push(`${file}: ${url}`);
  }
}
if (broken.length) {
  console.error(`broken internal links (${broken.length}):\n` + [...new Set(broken)].join('\n'));
  process.exit(1);
}
console.log(`internal links: ${pages.length} pages checked, none broken`);
