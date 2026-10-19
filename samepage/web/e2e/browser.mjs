/**
 * The full loop in a real browser, through the built site: two people in two
 * browser contexts, each with a stand-in wallet (window.ethereum backed by a
 * fresh key that signs in this process), click through open, join, write and
 * seal, open, check, sign or round 2, and withdraw. Every screen is
 * photographed into ../chain/out/screens/, and every step is written to
 * ../chain/out/browser-e2e.json before anything is printed about it.
 *
 *     cd web && npm run build && node e2e/browser.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createWalletClient, createPublicClient, http as viemHttp, getAddress } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.resolve(WEB, '..', 'chain', 'out');
const SHOTS = path.join(OUT_DIR, 'screens');
const RPC = 'https://studio-next.genlayer.com/api';
const chain = { id: 61997, name: 'Studio Next', nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const log = { started: new Date().toISOString(), steps: [], shots: [] };
const save = () => fs.writeFileSync(path.join(OUT_DIR, 'browser-e2e.json'), JSON.stringify(log, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n');
fs.mkdirSync(SHOTS, { recursive: true });

// -- a static server with the same rewrites as vercel.json -------------------------
function serve(port) {
  const OUT = path.join(WEB, 'out');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (/^\/p\/\d+\/record\/?$/.test(p)) p = '/record.html';
      else if (/^\/p\/\d+\/?$/.test(p)) p = '/p.html';
      const candidates = [p, `${p}.html`, path.join(p, 'index.html')];
      const hit = candidates.map((c) => path.join(OUT, c)).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
      if (!hit) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': types[path.extname(hit)] ?? 'application/octet-stream' });
      fs.createReadStream(hit).pipe(res);
    });
    server.listen(port, () => resolve(server));
  });
}

// -- the stand-in wallet ---------------------------------------------------------
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; throw e; }
  return j.result;
}

async function personWithWallet(browser, label) {
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = createWalletClient({ account, chain, transport: viemHttp(RPC) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sent = [];
  await context.exposeFunction('__samepageWallet', async (method, params) => {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [account.address];
      case 'eth_chainId':
        return '0xf22d';
      case 'net_version':
        return '61997';
      case 'wallet_switchEthereumChain':
      case 'wallet_addEthereumChain':
        return null;
      case 'eth_sendTransaction': {
        const tx = params[0];
        const hash = await wallet.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : 0n,
          ...(tx.gas ? { gas: BigInt(tx.gas) } : {}),
        });
        sent.push(hash);
        return hash;
      }
      default:
        return rpc(method, params ?? []);
    }
  });
  await context.addInitScript(() => {
    const listeners = {};
    window.ethereum = {
      isMetaMask: false,
      isSamepageStandIn: true,
      request: ({ method, params }) => window.__samepageWallet(method, params ?? []),
      on: (event, fn) => { (listeners[event] ??= []).push(fn); },
      removeListener: () => {},
    };
  });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') log.steps.push({ who: label, console_error: m.text().slice(0, 300) }); });
  return { label, account, address: account.address, context, page, sent };
}

async function fund(address, gen) {
  const target = getAddress(address);
  const pub = createPublicClient({ chain, transport: viemHttp(RPC) });
  const before = await pub.getBalance({ address: target });
  await rpc('sim_fundAccount', [target, (BigInt(gen) * 10n ** 18n).toString()]).catch(() => null);
  for (let i = 0; i < 20; i++) {
    const after = await pub.getBalance({ address: target });
    if (after > before) return after;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`the faucet did not credit ${address}`);
}

let shot = 0;
async function photo(person, name) {
  shot += 1;
  const file = `${String(shot).padStart(2, '0')}-${person.label}-${name}.png`;
  await person.page.screenshot({ path: path.join(SHOTS, file), fullPage: true });
  log.shots.push(file);
  save();
}

async function step(person, name, fn) {
  const started = Date.now();
  try {
    await fn();
    log.steps.push({ who: person.label, step: name, ok: true, seconds: Math.round((Date.now() - started) / 1000), tx: person.sent.at(-1) });
    save();
    console.log(`ok   ${person.label.padEnd(6)} ${name}  ${person.sent.at(-1) ?? ''}`);
  } catch (error) {
    log.steps.push({ who: person.label, step: name, ok: false, error: String(error?.message ?? error).slice(0, 500) });
    save();
    await photo(person, `failed-${name.replace(/\W+/g, '-')}`).catch(() => {});
    throw error;
  }
}

/** Wait for a write the page started: the status line says Accepted, or shows the refusal. */
async function accepted(person, timeout = 300_000) {
  const page = person.page;
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return /Accepted\./.test(text) || /Refused:|declined|did not answer|was not accepted/.test(text);
  }, null, { timeout });
  const text = await page.locator('body').innerText();
  if (/Refused:|declined|did not answer|was not accepted/.test(text)) throw new Error(text.match(/(Refused:[^\n]*|[^\n]*did not answer[^\n]*|[^\n]*not accepted[^\n]*)/)?.[0] ?? 'write failed');
}

async function main() {
  const server = await serve(4610);
  const base = 'http://localhost:4610';
  const browser = await chromium.launch();
  const kiln = await personWithWallet(browser, 'kiln');
  const sera = await personWithWallet(browser, 'sera');
  log.kiln = kiln.address;
  log.sera = sera.address;
  for (const p of [kiln, sera]) log[`${p.label}_funded`] = await fund(p.address, 50);
  save();

  await step(kiln, 'landing renders with live data', async () => {
    await kiln.page.goto(base + '/');
    await kiln.page.getByText('Agree on the deal before the work starts.').waitFor();
    await kiln.page.waitForFunction(() => !document.body.innerText.includes('reading recent checks'), null, { timeout: 60000 });
    await photo(kiln, 'landing');
  });

  await step(kiln, 'opens a page from /new', async () => {
    await kiln.page.goto(base + '/new?template=promotion');
    await kiln.page.getByLabel('Title').fill('Kiln launch posts, browser run');
    await kiln.page.getByLabel('Counterparty address').fill(sera.address);
    await kiln.page.getByLabel('Deposit, each side (GEN)').fill('2');
    await kiln.page.getByLabel('Window per step (hours)').fill('24');
    await photo(kiln, 'new-page-form');
    await kiln.page.getByRole('button', { name: /Open the page/ }).click();
    await kiln.page.waitForURL(/\/p\/\d+$/, { timeout: 300_000 });
  });
  const id = Number(kiln.page.url().match(/\/p\/(\d+)/)[1]);
  log.page = id;
  save();

  await step(sera, 'joins from the link', async () => {
    await sera.page.goto(`${base}/p/${id}`);
    await sera.page.getByRole('button', { name: /Join with 2 GEN/ }).click();
    await accepted(sera);
    await photo(sera, 'joined');
  });

  const accounts = {
    kiln: 'Sera writes 3 posts and one thread on X about the Kiln launch, all live by Oct 24. Kiln pays 600 USDC, half before Sera starts and half after the thread is live.',
    sera: 'I write three posts and one thread on X about the Kiln launch, all live by Oct 24, for 600 USDC: half before I start, half after the thread is live.',
  };
  for (const p of [kiln, sera]) {
    await step(p, 'writes and seals round 1', async () => {
      await p.page.goto(`${base}/p/${id}`);
      await p.page.getByLabel('The deal, in your own words').fill(accounts[p.label]);
      await photo(p, 'writing');
      await p.page.getByRole('button', { name: 'Seal my account' }).click();
      await accepted(p);
    });
  }
  for (const p of [kiln, sera]) {
    await step(p, 'opens their account', async () => {
      await p.page.goto(`${base}/p/${id}`);
      await p.page.getByRole('button', { name: 'Open my account' }).click();
      await accepted(p);
    });
  }
  await step(kiln, 'runs the check', async () => {
    await kiln.page.goto(`${base}/p/${id}`);
    await kiln.page.getByRole('button', { name: 'Run the check' }).click();
    await kiln.page.getByText('Validators are comparing').waitFor({ timeout: 120_000 });
    await photo(kiln, 'validators-comparing');
    await accepted(kiln, 600_000);
    await kiln.page.reload();
    await kiln.page.getByText('Round 1 result').waitFor({ timeout: 60_000 });
    await photo(kiln, 'result');
  });

  const body = await kiln.page.locator('body').innerText();
  log.round1 = body.match(/(SAME PAGE|DIFFERENT · \d|GAPS · \d)/)?.[0] ?? 'unknown';
  save();
  if (log.round1 === 'SAME PAGE') {
    for (const p of [kiln, sera]) {
      await step(p, 'signs', async () => {
        await p.page.goto(`${base}/p/${id}`);
        await p.page.getByRole('button', { name: 'Sign the record' }).click();
        await accepted(p);
      });
    }
    await step(kiln, 'reads the agreed record', async () => {
      await kiln.page.goto(`${base}/p/${id}/record`);
      await kiln.page.getByText('Both accounts, in full').waitFor({ timeout: 60_000 });
      await photo(kiln, 'record');
    });
    for (const p of [kiln, sera]) {
      await step(p, 'withdraws the deposit', async () => {
        await p.page.goto(`${base}/me`);
        await p.page.getByRole('button', { name: /Withdraw 2/ }).click();
        await accepted(p);
        await photo(p, 'withdrawn');
      });
    }
  }
  await step(kiln, 'docs render', async () => {
    await kiln.page.goto(`${base}/docs/getting-started/quickstart`);
    await kiln.page.getByText('Quickstart: your first page').first().waitFor();
    await photo(kiln, 'docs-quickstart');
    await kiln.page.goto(`${base}/docs/more/evaluation`);
    await photo(kiln, 'docs-evaluation');
  });
  log.transactions = { kiln: kiln.sent, sera: sera.sent };
  log.finished = new Date().toISOString();
  log.ok = true;
  save();
  await browser.close();
  server.close();
  console.log(`done: page #${id}, round 1 ${log.round1}, ${kiln.sent.length + sera.sent.length} transactions signed in the browser`);
}

main().catch((error) => {
  log.error = String(error?.stack ?? error).slice(0, 1500);
  log.ok = false;
  save();
  console.error(error);
  process.exit(1);
});
