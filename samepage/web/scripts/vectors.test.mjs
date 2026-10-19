// The browser's seal must produce the contract's bytes: same vectors as tests/test_direct.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { vectors } = JSON.parse(fs.readFileSync(new URL('../../tests/vectors.json', import.meta.url), 'utf8'));

// The same three lines as sealOf in lib/chain.ts; scripts/generate.mjs includes that function in the docs.
async function sealOf(text, salt, address) {
  const bytes = new TextEncoder().encode(`${text}|${salt}|${address.toLowerCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

test('lib/chain.ts sealOf is the function tested here', () => {
  const src = fs.readFileSync(new URL('../lib/chain.ts', import.meta.url), 'utf8');
  assert.match(src, /new TextEncoder\(\)\.encode\(`\$\{text\}\|\$\{salt\}\|\$\{address\.toLowerCase\(\)\}`\)/);
  assert.match(src, /crypto\.subtle\.digest\("SHA-256", bytes\)/);
});

for (const v of vectors) {
  test(`vector: ${v.text.slice(0, 40)}`, async () => {
    assert.equal(await sealOf(v.text, v.salt, v.address), v.seal);
  });
}
