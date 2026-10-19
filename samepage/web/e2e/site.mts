/**
 * The reviewer's path, walked through the site's own signing code (lib/chain.ts)
 * with a stand-in wallet: two accounts that have never touched the contract,
 * funded by the Studio faucet, take a page from open to withdraw, and every
 * balance is read back after finality.
 *
 *     cd web && npx tsx e2e/site.mts
 *
 * Writes ../chain/out/site-e2e.json before printing a summary (rule 33).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createAccount, generatePrivateKey } from 'genlayer-js';
import {
  CONTRACT, GEN, Refused, balanceOf, fund, readPage, sealOf, newSalt, send, writerFor, txUrl, returnedOf, listPages,
} from '../lib/chain.ts';

const OUT = path.resolve(import.meta.dirname, '..', '..', 'chain', 'out', 'site-e2e.json');
const log: Record<string, unknown> = { contract: CONTRACT, started: new Date().toISOString(), steps: [] as unknown[] };
const steps = log.steps as Record<string, unknown>[];
const save = () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(log, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n');
};

function wallet(label: string) {
  const account = createAccount(generatePrivateKey());
  console.log(`  ${label.padEnd(12)} ${account.address}`);
  return { label, account, address: account.address as string, client: writerFor({ account }) };
}
type W = ReturnType<typeof wallet>;

async function step(name: string, who: W, functionName: string, args: unknown[], value = 0n, opts: { refusal?: string; finalized?: boolean } = {}) {
  const started = Date.now();
  try {
    const { hash, receipt } = await send(who.client, { functionName, args, value, account: who.account }, { payee: who.address, waitUntil: opts.finalized ? 'finalized' : 'decided' });
    if (opts.refusal) throw new Error(`${name}: expected a refusal containing "${opts.refusal}", it was accepted (${hash})`);
    steps.push({ name, by: who.label, method: functionName, tx: hash, url: txUrl(hash), ok: true, seconds: Math.round((Date.now() - started) / 1000) });
    save();
    console.log(`  ok   ${name.padEnd(34)} ${txUrl(hash)}`);
    return { hash, receipt };
  } catch (error) {
    if (opts.refusal && error instanceof Refused && error.message.includes(opts.refusal)) {
      steps.push({ name, by: who.label, method: functionName, tx: error.hash, url: txUrl(error.hash), ok: false, refused: error.message });
      save();
      console.log(`  refused as expected ${name.padEnd(20)} "${error.message}" ${txUrl(error.hash)}`);
      return { hash: error.hash, receipt: null };
    }
    steps.push({ name, by: who.label, method: functionName, ok: false, error: String((error as Error)?.message ?? error).slice(0, 400) });
    save();
    throw error;
  }
}

async function sealAndKeep(who: W, _page: number, text: string) {
  // region: seal
  const salt = newSalt(); // 32 hex characters, kept with the text as the ticket
  const seal = await sealOf(text, salt, who.address);
  // endregion
  return { text, salt, seal };
}

async function main() {
  if (!CONTRACT) throw new Error('lib/deployment.json has no address; run scripts/generate.mjs after a deploy');
  console.log(`contract ${CONTRACT}\naccounts`);
  const kiln = wallet('kiln');
  const sera = wallet('sera');
  const stranger = wallet('stranger');
  for (const w of [kiln, sera, stranger]) {
    const { before, after } = await fund(w.address, 100n * GEN);
    console.log(`  funded ${w.label} ${before} -> ${after}`);
    if (after <= before) throw new Error(`the faucet did not credit ${w.label}`);
  }
  const deposit = 20n * GEN;
  log.deposit = deposit;

  // region: open-page
  const opened = await send(kiln.client, {
    functionName: 'open_page',
    args: ['Kiln launch posts', sera.address, deposit, 48],
    value: deposit,
    account: kiln.account,
  });
  const page = Number(returnedOf(opened.receipt));
  // endregion
  steps.push({ name: 'open the page with a 20 GEN deposit', by: 'kiln', method: 'open_page', tx: opened.hash, url: txUrl(opened.hash), ok: true });
  log.page = page;
  save();
  console.log(`  ok   open the page #${page}                ${txUrl(opened.hash)}`);

  await step('a stranger tries to join', stranger, 'join', [page], deposit, { refusal: 'only the named counterparty' });
  await step('sera joins with the same deposit', sera, 'join', [page], deposit);

  const r1 = {
    kiln: 'Sera writes 3 posts and a thread on X about the Kiln launch, all live by Oct 24. Kiln pays 600 USDC, all of it after the last post is live.',
    sera: 'I write 3 posts on X about the Kiln launch, all live by Oct 24. 600 USDC, half before I start and half after the last post.',
  };
  const k1 = await sealAndKeep(kiln, page, r1.kiln);
  const s1 = await sealAndKeep(sera, page, r1.sera);
  await step('kiln seals round 1', kiln, 'seal', [page, k1.seal]);
  await step('sera tries to open before both sealed', sera, 'reveal', [page, s1.text, s1.salt], 0n, { refusal: 'only after both sides have sealed' });
  await step('sera seals round 1', sera, 'seal', [page, s1.seal]);
  await step('kiln tries to open a different text', kiln, 'reveal', [page, r1.kiln.replace('600', '500'), k1.salt], 0n, { refusal: 'does not match your seal' });
  await step('kiln opens round 1', kiln, 'reveal', [page, k1.text, k1.salt]);
  await step('sera opens round 1', sera, 'reveal', [page, s1.text, s1.salt]);
  await step('the stranger runs the check, round 1', stranger, 'check', [page]);
  let state = await readPage(page);
  log.round1 = state?.rounds[0];
  save();
  console.log(`  round 1: ${state?.rounds[0].verdict} ${state?.rounds[0].statuses.join(',')}`);

  if (state?.step === 'SEALING' && state.round === 2) {
    const agreed = 'Sera writes 3 posts and one thread on X about the Kiln launch, all live by Oct 24. Kiln pays 600 USDC: half before Sera starts and half after the thread is live. Kiln may repost and quote them.';
    const k2 = await sealAndKeep(kiln, page, agreed);
    const s2 = await sealAndKeep(sera, page, 'I write three posts and one thread on X about Kiln\'s launch, all live by Oct 24, for 600 USDC: half before I start, half after the thread is live. Kiln can repost and quote them.');
    await step('kiln seals round 2', kiln, 'seal', [page, k2.seal]);
    await step('sera seals round 2', sera, 'seal', [page, s2.seal]);
    await step('kiln opens round 2', kiln, 'reveal', [page, k2.text, k2.salt]);
    await step('sera opens round 2', sera, 'reveal', [page, s2.text, s2.salt]);
    await step('kiln runs the check, round 2', kiln, 'check', [page]);
    state = await readPage(page);
    log.round2 = state?.rounds[1];
    save();
    console.log(`  round 2: ${state?.rounds[1].verdict} ${state?.rounds[1].statuses.join(',')}`);
  }

  if (state?.step === 'SIGNING') {
    await step('the stranger tries to sign', stranger, 'sign', [page], 0n, { refusal: 'not a side of this page' });
    await step('kiln signs', kiln, 'sign', [page]);
    await step('sera signs', sera, 'sign', [page], 0n, { finalized: true });
  }
  state = await readPage(page);
  log.final_step = state?.step;
  console.log(`  page #${page} is ${state?.step}`);

  // Balances to the wei: the contract's own GEN balance must drop by exactly
  // each withdrawal, and held must reach zero for this page's deposits.
  const balances: Record<string, unknown> = {};
  for (const w of [kiln, sera]) {
    const owed = BigInt((await listPages(w.address, 0, 1)).balance ?? '0');
    const contractBefore = await balanceOf(CONTRACT);
    const mineBefore = await balanceOf(w.address);
    if (owed === 0n) {
      balances[w.label] = { owed: '0' };
      continue;
    }
    await step(`${w.label} withdraws`, w, 'withdraw', [], 0n, { finalized: true });
    let contractAfter = await balanceOf(CONTRACT);
    for (let i = 0; i < 20 && contractAfter === contractBefore; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      contractAfter = await balanceOf(CONTRACT);
    }
    // The payout lands at finality as its own message; the contract's balance
    // can drop a moment before the payee's wallet shows it, so wait for both.
    let mineAfter = await balanceOf(w.address);
    for (let i = 0; i < 20 && mineAfter <= mineBefore; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      mineAfter = await balanceOf(w.address);
    }
    const left = BigInt((await listPages(w.address, 0, 1)).balance ?? '0');
    balances[w.label] = {
      owed_in_contract: owed,
      contract_balance_before: contractBefore,
      contract_balance_after: contractAfter,
      contract_paid_out: contractBefore - contractAfter,
      exact_to_the_wei: contractBefore - contractAfter === owed,
      account_before: mineBefore,
      account_after: mineAfter,
      account_gained_net_of_fees: mineAfter - mineBefore,
      balance_left_in_contract: left,
    };
    console.log(`  ${w.label}: contract paid out ${contractBefore - contractAfter} wei of ${owed} owed (${contractBefore - contractAfter === owed ? 'exact' : 'MISMATCH'})`);
  }
  log.balances = balances;
  await step('kiln tries to withdraw twice', kiln, 'withdraw', [], 0n, { refusal: 'nothing to withdraw' });
  log.finished = new Date().toISOString();
  log.ok = Object.values(balances).every((b) => (b as { exact_to_the_wei?: boolean; owed?: string }).exact_to_the_wei ?? (b as { owed?: string }).owed === '0');
  save();
  console.log(`done: ${log.ok ? 'every balance exact' : 'a balance did not match'}`);
  if (!log.ok) process.exit(1);
}

main().catch((error) => {
  log.error = String((error as Error)?.stack ?? error).slice(0, 1500);
  save();
  console.error(error);
  process.exit(1);
});
