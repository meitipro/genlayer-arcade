"use client";

/**
 * The /run page's engine: deploy, the reviewer's walk, the golden cases and
 * the seed, in the visitor's browser, with fresh test accounts that exist only
 * in this tab's memory. Each account is funded by Studio's faucet through
 * /api/faucet. No key is stored, printed, or sent to any server.
 *
 * It mirrors scripts/walk.py, eval/run_golden.py and scripts/seed.py step for
 * step and writes the same JSON shapes, so the files it produces can be
 * committed as deployment.json, eval/results.json, evidence/walk.json and
 * evidence/seed.json without editing.
 *
 * Nothing here decides a verdict. Every verdict is read back from get_appeal
 * after the validators have ruled.
 */

import { createAccount, generatePrivateKey } from "genlayer-js";

import { GEN, txUrl } from "./network";
import { WalletError, balanceOf, deployWith, localWriter, reader, retried, returnedOf, sendWith, type Phase } from "./wallet";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Rule = { text: string; first: number; repeat: number };
export type GoldenCase = { id: string; case_ref: string; rule: number; level: number; evidence: string; statement: string; reply: string; expected: string; expected_level?: string };
export type Golden = {
  court: { name: string; ladder: string[]; rules: Rule[]; appeal_fee_gen: number; compensation_gen: number; response_hours: number };
  cases: GoldenCase[];
  held_out: GoldenCase[];
};

export type Say = (line: string, hash?: string) => void;

type Account = { address: string; client: any };
type Outcome = { hash: string; ok: boolean; status: string; refusal: string; result?: unknown };

const today = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);

/** A fresh account, funded by the faucet. The balance moving is the only evidence it was funded. */
export async function freshAccount(say: Say, label: string): Promise<Account> {
  const account = createAccount(generatePrivateKey());
  const address = account.address as string;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch("/api/faucet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      say(`funded ${label} ${address.slice(0, 10)}…: ${Number(BigInt(body.after) / 10n ** 15n) / 1000} GEN`);
      break;
    }
    if (attempt >= 3) throw new Error(`The faucet would not fund ${label}: ${body?.message ?? response.status}`);
    const wait = Number(/(\d+) seconds/.exec(String(body?.message))?.[1] ?? 20);
    say(`faucet asked to wait ${wait} s for ${label}`);
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
  }
  return { address, client: localWriter(account) };
}

/** One write, recorded whether it succeeds or is refused. A refusal only throws when it was not expected. */
async function write(say: Say, who: Account, contract: string, functionName: string, args: unknown[], opts: { value?: bigint; expectRefusal?: boolean; finalized?: boolean; label?: string } = {}): Promise<Outcome> {
  const label = opts.label ?? functionName;
  try {
    const { hash, receipt } = await sendWith(who.client, who.address, { address: contract, functionName, args, value: opts.value ?? 0n }, undefined, opts.finalized ? "finalized" : "decided");
    say(`${label}: accepted`, hash);
    return { hash, ok: true, status: String(receipt?.lifecycle?.outcome ?? "accepted").toUpperCase(), refusal: "", result: returnedOf(receipt) };
  } catch (error) {
    const e = error as WalletError;
    if (e instanceof WalletError && e.code === "refused" && e.hash) {
      const refusal = e.message.replace(/^The contract refused it: /, "").replace(/\.$/, "");
      say(`${label}: refused (${refusal})`, e.hash);
      if (!opts.expectRefusal) throw error;
      return { hash: e.hash, ok: false, status: "REFUSED", refusal };
    }
    throw error;
  }
}

export async function readJson(contract: string, functionName: string, args: unknown[]): Promise<any> {
  const raw = await retried(() => reader().readContract({ address: contract, functionName, args }));
  return JSON.parse(String(raw));
}

const idOf = (outcome: Outcome) => Number(String(outcome.result ?? "").replace(/"/g, "")) || 0;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- 1. deploy ---------------------------------------------------------------

export async function deploy(say: Say, onPhase?: (phase: Phase, hash?: string) => void) {
  const code = await (await fetch("/api/contract-source")).text();
  const schema: any = await retried(() => reader().getContractSchemaForCode(code));
  say(`the live runtime accepts unban.py: ${Object.keys(schema?.methods ?? {}).length} public methods`);
  const deployer = await freshAccount(say, "deployer");
  const { address, hash } = await deployWith(deployer.client, code, onPhase);
  say(`deployed Unban at ${address}`, hash);
  return {
    network: "studio-next",
    chain_id: 61997,
    rpc: "https://studio-next.genlayer.com/api",
    address,
    deploy_tx: hash,
    source_sha256: await sha256(code),
    deployed_from_commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "",
    deployed_at: new Date().toISOString().slice(0, 19) + "+00:00",
    deployed_by: deployer.address,
  };
}

// ---- 2. the reviewer's walk -----------------------------------------------------

export async function walk(say: Say, contract: string, golden: Golden) {
  const started = stamp();
  const owner = await freshAccount(say, "walk owner");
  const mod = await freshAccount(say, "walk moderator");
  const member = await freshAccount(say, "walk member");
  const log: any = { contract, started, accounts: { owner: owner.address, moderator: mod.address, member: member.address }, steps: [] as any[] };
  const step = (name: string, o: Outcome, extra: Record<string, unknown> = {}) =>
    log.steps.push({ step: name, hash: o.hash, ok: o.ok, status: o.status, refusal: o.refusal, explorer: txUrl(o.hash), ...extra });

  const court = golden.court;
  const opened = await write(say, owner, contract, "open_court", [
    `Kiln Discord (walk ${started.slice(-6)})`, JSON.stringify(court.rules), JSON.stringify(court.ladder), JSON.stringify([mod.address]), 2n * GEN, 5n * GEN, 48,
  ], { value: 10n * GEN });
  const courtId = idOf(opened) || (await readJson(contract, "list_appeals", [0, "", 0, 1])).courts;
  step("open_court", opened, { court_id: courtId });

  const c = golden.cases[0];
  const filed = await write(say, member, contract, "appeal", [courtId, c.case_ref.replace("{date}", today()), c.statement], { value: 2n * GEN });
  const appealId = idOf(filed) || (await readJson(contract, "list_appeals", [courtId, "", 0, 1])).items[0].id;
  step("appeal", filed, { appeal_id: appealId });

  step("refused: member answers own appeal", await write(say, member, contract, "respond", [appealId, 1, 4, "x"], { expectRefusal: true, label: "member tries to answer" }));
  step("respond", await write(say, mod, contract, "respond", [appealId, c.rule, c.level, c.evidence]));
  step("refused: judge before the reply window", await write(say, owner, contract, "judge", [appealId], { expectRefusal: true, label: "judge before the reply window" }));
  step("reply", await write(say, member, contract, "reply", [appealId, c.reply]));
  const judged = await write(say, owner, contract, "judge", [appealId], { expectRefusal: true });
  const view = await readJson(contract, "get_appeal", [appealId]);
  say(`ruling: ${view.status} ${view.new_level} (${view.reason})`);
  step("judge", judged, { verdict: view.status, level: view.new_level, reason: view.reason, member_balance: view.member_balance });

  const owed = BigInt(view.member_balance);
  if (owed > 0n) {
    const heldBefore = await balanceOf(contract);
    const memberBefore = await balanceOf(member.address);
    const withdrawn = await write(say, member, contract, "withdraw", [], { finalized: true });
    const heldAfter = await balanceOf(contract);
    const memberAfter = await balanceOf(member.address);
    step("withdraw", withdrawn, {
      owed: owed.toString(), contract_before: heldBefore.toString(), contract_after: heldAfter.toString(), contract_drop: (heldBefore - heldAfter).toString(),
      member_before: memberBefore.toString(), member_after: memberAfter.toString(), exact: heldBefore - heldAfter === owed,
    });
    say(`contract balance dropped ${Number((heldBefore - heldAfter) / 10n ** 15n) / 1000} GEN; owed ${Number(owed / 10n ** 15n) / 1000} GEN`);
    step("refused: withdraw again", await write(say, member, contract, "withdraw", [], { expectRefusal: true, label: "withdraw again" }));
  } else {
    say("the ruling owes the member nothing, so there is nothing to withdraw");
  }
  log.finished = stamp();
  return log;
}

// ---- 3. the golden cases ----------------------------------------------------------

export async function goldenRun(say: Say, contract: string, golden: Golden, onCase?: (record: any) => void) {
  const owner = await freshAccount(say, "golden owner");
  const mod = await freshAccount(say, "golden moderator");
  const court = golden.court;
  const opened = await write(say, owner, contract, "open_court", [
    `${court.name} (golden)`, JSON.stringify(court.rules), JSON.stringify(court.ladder), JSON.stringify([mod.address]),
    BigInt(court.appeal_fee_gen) * GEN, BigInt(court.compensation_gen) * GEN, court.response_hours,
  ], { value: 20n * GEN });
  const courtId = idOf(opened) || (await readJson(contract, "list_appeals", [0, "", 0, 1])).courts;
  const record: any = { contract, network: "studio-next", chain_id: 61997, court_id: courtId, open_court_tx: opened.hash, cases: [] as any[] };
  const fee = BigInt(court.appeal_fee_gen) * GEN;
  for (const c of [...golden.cases, ...golden.held_out]) {
    say(`case ${c.id}: filing`);
    const member = await freshAccount(say, `member ${c.id}`);
    const row: any = { id: c.id, expected: c.expected, expected_level: c.expected_level ?? "", started: new Date().toISOString().slice(0, 19), txs: {}, judge_attempts: [] };
    record.cases.push(row);
    const filed = await write(say, member, contract, "appeal", [courtId, c.case_ref.replace("{date}", today()), c.statement], { value: fee });
    row.txs.appeal = filed.hash;
    row.appeal_id = idOf(filed) || (await readJson(contract, "list_appeals", [courtId, "", 0, 1])).items[0].id;
    row.txs.respond = (await write(say, mod, contract, "respond", [row.appeal_id, c.rule, c.level, c.evidence])).hash;
    row.txs.reply = (await write(say, member, contract, "reply", [row.appeal_id, c.reply])).hash;
    // Sent again only when a round produced no verdict at all; every attempt is kept.
    for (let attempt = 0; attempt < 3; attempt++) {
      const o = await write(say, owner, contract, "judge", [row.appeal_id], { expectRefusal: true, label: `judge case ${c.id}` });
      row.judge_attempts.push({ hash: o.hash, status: o.status, ok: o.ok, detail: o.refusal });
      if (o.ok) break;
    }
    const view = await readJson(contract, "get_appeal", [row.appeal_id]);
    row.verdict = view.status;
    row.level = view.new_level;
    row.reason = view.reason;
    row.pass = c.expected === "EITHER" ? null : view.status === c.expected && view.new_level === (c.expected_level ?? "");
    say(`case ${c.id}: ${view.status} ${view.new_level} (expected ${c.expected} ${c.expected_level ?? ""})`);
    onCase?.(record);
  }
  return record;
}

// ---- 4. the seed -------------------------------------------------------------------

const QUILL_RULES: Rule[] = [
  { text: "Be civil: no insults, slurs or harassment.", first: 2, repeat: 3 },
  { text: "No links to token sales, presales or airdrops.", first: 3, repeat: 3 },
  { text: "English in the main group.", first: 1, repeat: 2 },
];

export async function seed(say: Say, contract: string, golden: Golden) {
  const owner = await freshAccount(say, "seed owner");
  const mod = await freshAccount(say, "seed moderator");
  const log: any = { contract, txs: [] as any[], appeals: [] as number[] };
  const court = golden.court;
  const kiln = await write(say, owner, contract, "open_court", ["Kiln Discord", JSON.stringify(court.rules), JSON.stringify(court.ladder), JSON.stringify([mod.address]), 2n * GEN, 5n * GEN, 48], { value: 40n * GEN });
  const quill = await write(say, owner, contract, "open_court", ["Quill Telegram", JSON.stringify(QUILL_RULES), JSON.stringify(["warning", "24h mute", "ban"]), JSON.stringify([mod.address]), 1n * GEN, 2n * GEN, 12], { value: 10n * GEN });
  const head = await readJson(contract, "list_appeals", [0, "", 0, 1]);
  const ids = { Kiln: idOf(kiln) || head.courts - 1, Quill: idOf(quill) || head.courts };
  log.courts = ids;
  log.txs.push({ step: "open Kiln", hash: kiln.hash }, { step: "open Quill", hash: quill.hash });
  const waiting: [keyof typeof ids, string, string, [number, number, string] | null][] = [
    ["Kiln", "mirrr2 on Discord, banned {date}", "One gm too many and I am banned? I spammed gm at launch, I know, but a first spam is a mute in the rules.", null],
    ["Kiln", "0xbeck on Discord, banned {date}", "Caught in the raid purge. I have been a member since the testnet and posted nothing during the raid.", [1, 4, "[22:10 #general] 0xbeck: lol the raid bots are back\n[22:11 #general] 0xbeck: mods pls"]],
    ["Quill", "hollis on Telegram, banned {date}", "Banned for posting in Spanish once. The rules say a warning for that.", null],
  ];
  for (const [name, caseRef, statement, answer] of waiting) {
    const member = await freshAccount(say, `seed member ${caseRef.split(" ")[0]}`);
    const filed = await write(say, member, contract, "appeal", [ids[name], caseRef.replace("{date}", today()), statement], { value: name === "Kiln" ? 2n * GEN : GEN });
    const appealId = idOf(filed) || (await readJson(contract, "list_appeals", [ids[name], "", 0, 1])).items[0].id;
    log.appeals.push(appealId);
    log.txs.push({ step: `appeal ${appealId}`, hash: filed.hash });
    if (answer) {
      const done = await write(say, mod, contract, "respond", [appealId, ...answer]);
      log.txs.push({ step: `respond ${appealId}`, hash: done.hash });
    }
  }
  return log;
}
