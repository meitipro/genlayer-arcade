/**
 * Everything the site and the docs take from the repository, generated before
 * every build, so a method cannot exist in the contract and be missing from
 * the docs, and no number is typed by hand:
 *
 *   lib/deployment.json         <- ../deployments.json (current)
 *   lib/seed.json               <- ../chain/out/seed.json
 *   content/docs/**             <- docs-src/**, with code regions included from
 *                                  the files that run, plus the generated pages:
 *   reference/contract.mdx      <- ../contracts/samepage.py
 *   reference/errors.mdx        <- ../contracts/samepage.py
 *   reference/addresses.mdx     <- ../deployments.json
 *   reference/hashing.mdx       <- docs-src + ../tests/vectors.json
 *   more/judge-prompt.mdx       <- ../tests/judge_prompt.txt + the contract
 *   more/evaluation.mdx         <- ../eval/golden.json + ../eval/results.json
 *   lib/doc-meta.json           <- git log, for "last updated" and "edit on GitHub"
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(WEB, '..');
const SRC = path.join(WEB, 'docs-src');
const OUT = path.join(WEB, 'content', 'docs');
const EXPLORER = 'https://explorer-studio-dev.genlayer.com';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const json = (p, fallback) => (exists(p) ? JSON.parse(read(p)) : fallback);
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');

function updated(...files) {
  let best = '';
  for (const f of files) {
    try {
      const d = execFileSync('git', ['log', '-1', '--format=%cI', '--', f], { cwd: ROOT, encoding: 'utf8' }).trim();
      if (d && d > best) best = d;
    } catch {
      // no git history in this checkout
    }
  }
  return best;
}

const meta = {};
const page = (rel, text, sources) => {
  write(path.join(OUT, rel), text);
  meta[rel] = { updated: updated(...sources), source: sources[0] };
};

// -- data for the site ---------------------------------------------------------
const deployments = json('deployments.json', {});
const current = deployments.current ?? {};
write(path.join(WEB, 'lib', 'deployment.json'), JSON.stringify(current, null, 2) + '\n');
write(path.join(WEB, 'lib', 'seed.json'), JSON.stringify(json('chain/out/seed.json', {}), null, 2) + '\n');

// -- regions from the code that runs -------------------------------------------
function region(file, name) {
  const text = read(file);
  if (name.startsWith('def:')) {
    // A whole top-level Python function, so the contract itself carries no markers.
    const all = text.split('\n');
    const at = all.findIndex((l) => l.startsWith(`def ${name.slice(4)}(`));
    if (at < 0) throw new Error(`no function ${name.slice(4)} in ${file}`);
    let end = at + 1;
    while (end < all.length && (all[end] === '' || /^\s/.test(all[end]))) end++;
    return all.slice(at, end).join('\n').replace(/\s+$/, '');
  }
  const start = new RegExp(`^\\s*(#|//) region: ${name}\\s*$`, 'm');
  const m = text.match(start);
  if (!m) throw new Error(`no region ${name} in ${file}`);
  const after = text.slice(m.index + m[0].length + 1);
  const end = after.search(/^\s*(#|\/\/) endregion\s*$/m);
  if (end < 0) throw new Error(`region ${name} in ${file} is not closed`);
  const lines = after.slice(0, end).replace(/\s+$/, '').split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(indent)).join('\n');
}

function expand(text) {
  return text.replace(/^\{\/\* include: (\S+?)#(\S+?) \*\/\}$/gm, (_, file, name) => {
    const lang = file.endsWith('.py') ? 'python' : file.endsWith('.ts') || file.endsWith('.mts') ? 'ts' : '';
    return '```' + lang + ` title="${file}"\n` + region(file, name) + '\n```';
  });
}

// -- authored pages, copied with their includes --------------------------------
for (const file of fs.readdirSync(SRC, { recursive: true })) {
  const full = path.join(SRC, file);
  if (fs.statSync(full).isDirectory()) continue;
  const rel = file.split(path.sep).join('/');
  let text = fs.readFileSync(full, 'utf8');
  if (rel.endsWith('.mdx')) text = expand(text);
  if (rel === 'reference/hashing.mdx') text = text.replace('{/* vectors */}', vectorsTable());
  if (rel.endsWith('.mdx')) page(rel, text, [`web/docs-src/${rel}`]);
  else write(path.join(OUT, rel), text);
}

function vectorsTable() {
  const { rule, vectors } = json('tests/vectors.json', { vectors: [] });
  const rows = vectors.map((v) => `| ${esc(v.text.length > 60 ? v.text.slice(0, 57) + '…' : v.text).replace(/\n/g, '⏎')} | \`${v.salt}\` | \`${v.address}\` | \`${v.seal}\` |`);
  return [`The rule, as \`tests/vectors.json\` states it: ${rule}.`, '', '| text | salt | address | seal |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

// -- the contract reference ------------------------------------------------------
const contract = read('contracts/samepage.py');
const lines = contract.split('\n');
const methods = [];
for (let i = 0; i < lines.length; i++) {
  const dec = lines[i].match(/^    @gl\.public\.(write\.payable|write|view)\s*$/);
  if (!dec) continue;
  const sig = lines[i + 1].match(/^    def (\w+)\(self(?:, )?(.*)\)(?: -> (.+))?:/);
  if (!sig) continue;
  let j = i + 2;
  let doc = '';
  if (lines[j].trim().startsWith('"""')) {
    const buf = [];
    let first = lines[j].trim().slice(3);
    if (first.endsWith('"""')) buf.push(first.slice(0, -3));
    else {
      buf.push(first);
      j++;
      while (!lines[j].includes('"""')) buf.push(lines[j++].trim());
      buf.push(lines[j].trim().replace('"""', ''));
    }
    doc = buf.join(' ').replace(/\s+/g, ' ').trim();
  }
  let k = i + 2;
  while (k < lines.length && !/^    (@|def )/.test(lines[k])) k++;
  const body = lines.slice(i + 2, k).join('\n');
  const refusals = [...body.matchAll(/UserError\(E \+ "([^"]+)"\)/g)].map((m) => m[1]);
  if (/self\._key\(/.test(body)) refusals.unshift('no such page');
  if (/self\._side\(/.test(body)) refusals.push('not a side of this page');
  if (/self\._in_window\(/.test(body)) refusals.push('the window for this step has closed');
  if (/_address\(/.test(body)) refusals.push('not an address');
  methods.push({ kind: dec[1].replace('write.payable', 'payable'), name: sig[1], params: sig[2], ret: sig[3] ?? 'None', doc, refusals: [...new Set(refusals)], line: i + 2 });
}
if (methods.length !== 10) throw new Error(`expected 10 public methods, found ${methods.length}`);

const SUMMARY = {
  open_page: 'Opens a page with the opener\u2019s deposit. Returns the page id.',
  join: 'The named counterparty joins with the same deposit.',
  seal: 'Seals this round\u2019s account, once per side per round.',
  reveal: 'Opens an account after both sealed, checked against its seal.',
  check: 'Compares the two accounts on six terms and sets the verdict.',
  sign: 'Signs a SAME PAGE record; both signatures make it AGREED.',
  no_show: 'After a missed window, settles the page by rule.',
  withdraw: 'Top-level transfer of the caller\u2019s balance.',
  get_page: 'Title, sides, rounds, accounts once opened, statuses, notes, signatures.',
  list_pages: 'Pages an address opened or was named in; the zero address lists every page.',
};
const blob = `https://github.com/meitipro/genlayer-arcade/blob/claude/project-deploy-test-t7j87s/samepage/contracts/samepage.py`;
let ref = `---
title: Contract reference
description: Generated from contracts/samepage.py at build time. Ten public methods, nothing else.
---

{/* Generated by web/scripts/generate.mjs from contracts/samepage.py. Do not edit. */}

The table and every section below are read out of [\`contracts/samepage.py\`](${blob}) when the site builds, and the build fails if the contract does not have exactly ten public methods. A method cannot exist in the code and be missing here.

| method | kind | what it does |
| --- | --- | --- |
${methods.map((m) => `| [\`${m.name}\`](#${m.name.replace(/_/g, '_')}) | ${m.kind} | ${esc(SUMMARY[m.name] ?? '')} |`).join('\n')}

${current.address ? `<Callout>Deployed at [\`${current.address}\`](${EXPLORER}/address/${current.address}) on Studio Next, from commit \`${(current.deployed_from_commit ?? '').slice(0, 7)}\`.</Callout>` : ''}
`;
for (const m of methods) {
  ref += `
## ${m.name}

\`\`\`python
${m.kind === 'view' ? '@gl.public.view' : m.kind === 'payable' ? '@gl.public.write.payable' : '@gl.public.write'}
def ${m.name}(self${m.params ? ', ' + m.params : ''}) -> ${m.ret}
\`\`\`

${m.doc ? esc(m.doc) + '\n\n' : ''}${m.kind === 'payable' ? 'Send exactly the page\u2019s deposit as the transaction value.\n\n' : ''}${m.refusals.length ? `Refuses with: ${m.refusals.map((r) => `\`${esc(r)}\``).join(', ')}.\n\n` : ''}[Source, line ${m.line}](${blob}#L${m.line})
`;
}
page('reference/contract.mdx', ref, ['contracts/samepage.py']);

const errors = `---
title: Errors
description: Every refusal the contract can raise, by method, generated from the source.
---

{/* Generated by web/scripts/generate.mjs from contracts/samepage.py. Do not edit. */}

Every business rule raises \`gl.vm.UserError\` with the prefix \`[EXPECTED] \`, so the sentence is identical on every validator and the committee agrees that the refusal is the right result. A refused write is still **accepted** by consensus: success is an accepted transaction whose execution finished with a return, and the site and the scripts test exactly that.

A model answer that cannot be read raises with \`[LLM_ERROR] \`, which never matches between nodes, so the round goes to a different committee instead of storing a bad answer.

| method | refusal |
| --- | --- |
${methods.flatMap((m) => m.refusals.map((r) => `| \`${m.name}\` | ${esc(r)} |`)).join('\n')}

A view that raises comes back from the RPC as a bare \`execution failed\`, without the sentence. The site reads that from \`get_page\` as "there is no such page".
`;
page('reference/errors.mdx', errors, ['contracts/samepage.py']);

const history = deployments.history ?? [];
const addresses = `---
title: Addresses and network
description: Where Samepage runs, read from deployments.json.
---

{/* Generated by web/scripts/generate.mjs from deployments.json. Do not edit. */}

| | |
| --- | --- |
| Network | GenLayer Studio Next |
| Chain id | 61997 (\`0xf22d\`) |
| RPC | \`https://studio-next.genlayer.com/api\` |
| Explorer | [${EXPLORER.replace('https://', '')}](${EXPLORER}) |
| Native token | GEN, 18 decimals; the Studio faucet funds test accounts |
| Runtime | \`py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng\` |

${current.address ? `## Current deployment

| | |
| --- | --- |
| Contract | [\`${current.address}\`](${EXPLORER}/address/${current.address}) |
| Deploy transaction | [\`${current.deploy_tx}\`](${EXPLORER}/tx/${current.deploy_tx}) |
| Source sha256 | \`${current.sha256}\` (${current.bytes} bytes) |
| Source read back from the chain | ${current.source_matches ? 'matches the repository' : '**does not match**'} |
| Deployed from commit | \`${current.deployed_from_commit}\` |
| Deployed at | ${current.deployed_at} |
` : '<Callout type="warn">No deployment recorded yet.</Callout>'}
${history.length > 1 ? `## Earlier deployments\n\n| address | deploy transaction | at |\n| --- | --- | --- |\n${history.slice(0, -1).map((h) => `| [\`${h.address}\`](${EXPLORER}/address/${h.address}) | [\`${h.deploy_tx.slice(0, 12)}…\`](${EXPLORER}/tx/${h.deploy_tx}) | ${h.deployed_at} |`).join('\n')}\n` : ''}
\`scripts/verify.py\` reads the source back with \`gen_getContractCode\`, compares it to \`contracts/samepage.py\` byte for byte and runs \`genvm-lint\` over the bytes that came back.
`;
page('reference/addresses.mdx', addresses, ['deployments.json']);

const prompt = read('tests/judge_prompt.txt').replace(/\n+$/, '');
const judge = `---
title: The judge prompt, word for word
description: The exact text every validator sends to its model, from the contract.
---

{/* Generated by web/scripts/generate.mjs. Do not edit. */}

This is the constant \`JUDGE\` in \`contracts/samepage.py\`, with its three slots shown as they are filled. \`tests/test_static.py\` asserts that it is section 3 of the build spec, word for word.

\`\`\`text title="contracts/samepage.py: JUDGE"
${prompt}
\`\`\`

## How the slots are filled

{/* include: contracts/samepage.py#def:fence */}

{/* include: contracts/samepage.py#def:build_prompt */}

Every account reaches the model between \`<<<\` and \`>>>\`. A writer could type \`>>>\` and close the fence early, so \`fence()\` replaces \`<\` and \`>\` with \`(\` and \`)\` at the prompt boundary. Replacing keeps the length, so a capped account cannot grow past its cap, and storage keeps exactly what each side wrote. A test asserts one opening and one closing fence per account whatever the accounts contain.

## Both orders, in one block

The six statuses are symmetric, so the contract asks the same prompt twice inside one non-deterministic block: once with the opener's account as A, once with the counterparty's. A term the two orders read differently is stored as DIFFER, because an answer that depends on which account was read first is not two accounts that clearly mean the same thing.

{/* include: contracts/samepage.py#def:judge */}

## What validators compare

Each validator runs the same two calls and compares the six statuses, in order, with the leader's. Nothing else: not the notes, not which terms split. The verdict is never asked for; the contract computes it.

{/* include: contracts/samepage.py#def:verdict_of */}
`;
page('more/judge-prompt.mdx', expand(judge), ['tests/judge_prompt.txt', 'contracts/samepage.py']);

// -- evaluation -------------------------------------------------------------------
const golden = json('eval/golden.json', { cases: [] });
const results = json('eval/results.json', { cases: {} });
const TERMS = ['amount', 'deliverable', 'deadline', 'payment', 'rights', 'cancellation'];
const lock = exists('eval/GOLDEN.lock') ? read('eval/GOLDEN.lock').split(/\s+/)[1] : '';
const label = (e) => {
  if (!e?.verdict) return 'no verdict';
  const st = e.statuses ?? {};
  if (e.verdict === 'SAME_PAGE') return 'SAME PAGE';
  if (e.verdict === 'DIFFERENT') return `DIFFERENT · ${TERMS.filter((t) => st[t] === 'DIFFER').length}`;
  return `GAPS · ${TERMS.slice(0, 3).filter((t) => st[t] === 'ABSENT').length}`;
};
let scored = 0;
let passed = 0;
const rows = golden.cases.map((c) => {
  const e = results.cases?.[c.id];
  const ok = e?.attempts?.filter((a) => a.ok).map((a) => a.tx) ?? [];
  const tx = ok.length ? `[${ok[ok.length - 1].slice(0, 10)}…](${EXPLORER}/tx/${ok[ok.length - 1]})` : '';
  let result = 'not run';
  if (e) {
    if (c.expected === null) result = 'held out';
    else {
      scored++;
      if (e.pass) passed++;
      result = e.pass ? 'pass' : `**miss** (${e.terms_right ?? 0}/6 terms)`;
    }
  }
  const statuses = e?.statuses ? TERMS.map((t) => e.statuses[t]).join(' · ') : '';
  return `| ${c.id} | ${esc(c.why)} | ${c.verdict.replace('_', ' ')} | ${label(e)} | ${statuses} | ${result} | ${tx} |`;
});
const evaluation = `---
title: Evaluation results with transactions
description: The golden cases of the build spec, run through real consensus on Studio Next, published as they came out.
---

{/* Generated by web/scripts/generate.mjs from eval/golden.json and eval/results.json. Do not edit. */}

\`eval/golden.json\` was written, hashed (sha256 \`${lock}\`) and committed **before the first run**, and \`eval/run_golden.py\` refuses to run if the file no longer matches that hash. Each case is one page between two fresh accounts: open, join, both seal, both open, check. The statuses are read back from \`get_page\`. A case is scored on all six statuses; H1 to H3 are held out with no expected answer and ran once. A check is sent again only when its round produced no verdict at all, and every attempt is in \`eval/results.json\`.

${scored ? `**${passed} of ${scored}** scored cases matched on all six statuses.` : '<Callout type="warn">The golden run has not been recorded yet.</Callout>'}

| case | what it tests | expected | came out | amount · deliverable · deadline · payment · rights · cancellation | result | check |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

The misses are the most useful rows on this page: they show where the rubric reads a pair differently from the person who wrote the case, and the rubric was not changed to make them pass.

## The pairs

${golden.cases.map((c) => `### Case ${c.id}\n\n- **A:** ${esc(c.a)}\n- **B:** ${esc(c.b)}\n${results.cases?.[c.id]?.notes && Object.keys(results.cases[c.id].notes).length ? `- **Leader's notes:** ${Object.entries(results.cases[c.id].notes).map(([t, n]) => `${t}: ${esc(n)}`).join('; ')}\n` : ''}`).join('\n')}
`;
page('more/evaluation.mdx', evaluation, ['eval/results.json', 'eval/golden.json']);

write(path.join(WEB, 'lib', 'doc-meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`generated ${Object.keys(meta).length} docs pages; ${methods.length} contract methods; deployment ${current.address ?? 'none'}`);
