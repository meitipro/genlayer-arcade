#!/usr/bin/env node
// Wallet mode, end to end, against a running site:
//
//   node scripts/wallet-e2e.mjs https://genlayergamehub.vercel.app [verdict|bridge|oracle]
//
// A fresh throwaway wallet (key generated here, never stored or printed) acts as
// an EIP-1193 provider the way MetaMask does: eth_sendTransaction is signed
// locally and sent to Studionet; every other call goes to the network. The
// script then follows the browser's own path (lib/client/wallet.ts): the site
// faucet, genlayer-js with the site's /api/rpc relay as endpoint, writeContract
// from the wallet address, POST /register, and status polling until decided.
// Steps are appended to docs/wallet-e2e.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = (process.argv[2] || "https://genlayergamehub.vercel.app").replace(/\/$/, "");
const GAME = process.argv[3] || "verdict";
const RPC = "https://studio.genlayer.com/api";
const LOG = new URL("../docs/wallet-e2e.json", import.meta.url);
const deployment = JSON.parse(readFileSync(new URL("../lib/deployment.json", import.meta.url), "utf8"));
const ENV = { verdict: "VERDICT_CONTRACT", bridge: "BRIDGE_CONTRACT", oracle: "ORACLE_CONTRACT" }[GAME];
const FN = GAME === "oracle" ? "guess" : "submit";

const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : { runs: [] };
const run = { site: BASE, game: GAME, started: new Date().toISOString(), steps: [] };
log.runs.push(run);
const save = () => writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
let failures = 0;
const step = (name, pass, detail = {}) => {
  run.steps.push({ step: name, pass, at: new Date().toISOString(), ...detail });
  save();
  if (!pass) failures++;
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name} ${JSON.stringify(detail).slice(0, 240)}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then((x) => x.json());
  if (r.error) throw new Error(JSON.stringify(r.error));
  return r.result;
}

const account = privateKeyToAccount(generatePrivateKey());
const address = account.address;
const name = `w_${address.toLowerCase().slice(2, 20)}`;
run.wallet = address;
run.player = name;
const provider = {
  async request({ method, params = [] }) {
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
    if (method === "eth_chainId") return "0xf22f";
    if (method === "eth_sendTransaction") {
      const t = params[0];
      const raw = await account.signTransaction({
        type: "legacy",
        to: t.to,
        data: t.data,
        value: BigInt(t.value ?? "0x0"),
        gas: BigInt(t.gas),
        gasPrice: BigInt(t.gasPrice ?? (await rpc("eth_gasPrice", []))),
        nonce: Number(t.nonce),
        chainId: Number(t.chainId ?? 61999),
      });
      return rpc("eth_sendRawTransaction", [raw]);
    }
    return rpc(method, params);
  },
};

// the site's relay refuses anything that signs or spends
const refused = await fetch(`${BASE}/api/rpc`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: ["0x00"] }) });
step("the /api/rpc relay refuses signing methods", refused.status === 400, { status: refused.status });

const fund = await fetch(`${BASE}/api/faucet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: address.toLowerCase() }) });
step("site faucet funds a fresh wallet (lowercase address in, checksummed out)", fund.ok, { status: fund.status, body: await fund.json().catch(() => ({})) });
let bal = 0n;
for (let i = 0; i < 10 && bal === 0n; i++) {
  bal = BigInt(await rpc("eth_getBalance", [address, "latest"]));
  if (bal === 0n) await sleep(1500);
}
step("the balance moved", bal > 0n, { wei: bal.toString() });
const again = await fetch(`${BASE}/api/faucet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
step("the same address cannot be funded again within 10 minutes", again.status === 429, { status: again.status });

const round = (await fetch(`${BASE}/api/daily/${GAME}/round`).then((x) => x.json())).round;
step("an open round exists", !!round, { round: round?.id });
const body =
  GAME === "verdict"
    ? "A tutor app where AI validators agree whether a homework answer is right, not just one model."
    : GAME === "bridge"
      ? `${round.start} sky ${round.end}`
      : 17;
const args = GAME === "oracle" ? [round.id, name, body] : [round.id, name, body];

const proxy = `${BASE}/api/rpc`;
const chain = { ...studionet, rpcUrls: { default: { http: [proxy] } } };
const client = createClient({ chain, account: address, provider, endpoint: proxy });
let hash = null;
try {
  hash = await client.writeContract({ address: deployment.contracts[ENV], functionName: FN, args, value: 0n });
  step("wallet sent the submit itself, through the site relay for reads", /^0x[0-9a-f]{64}$/i.test(hash), { hash, args });
} catch (e) {
  step("wallet sent the submit itself, through the site relay for reads", false, { error: String(e?.message ?? e).slice(0, 300) });
}

if (hash) {
  const reg = await fetch(`${BASE}/api/daily/${GAME}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hash }) });
  const rd = await reg.json().catch(() => ({}));
  step("the hub verified the transaction and recorded it under the wallet name", reg.ok && rd.player === name, { status: reg.status, body: rd });
  let st = null;
  const begin = Date.now();
  while (Date.now() - begin < 240000) {
    st = await fetch(`${BASE}/api/daily/${GAME}/status?hash=${hash}`).then((x) => x.json());
    if (["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED"].includes(st.status) && (st.result || !["ACCEPTED", "FINALIZED"].includes(st.status))) break;
    await sleep(5000);
  }
  step("decided on chain", st && ["ACCEPTED", "FINALIZED"].includes(st.status) && st.result === "FINISHED_WITH_RETURN", {
    status: st?.status,
    result: st?.result,
    agree: st?.agree,
    voters: st?.voters,
    explorer: `https://explorer-studio.genlayer.com/tx/${hash}`,
  });
  await sleep(2000);
  const e = await fetch(`${BASE}/api/daily/${GAME}/entry?round=${round.id}&player=${name}`).then((x) => x.json());
  step("entry read back from the contract", !!e.entry, { entry: e.entry });

  // a transaction from another address cannot be registered under this name
  const forged = await fetch(`${BASE}/api/daily/${GAME}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hash: `0x${"cd".repeat(32)}` }) });
  step("an unknown hash cannot be registered", !forged.ok, { status: forged.status });
}

run.finished = new Date().toISOString();
run.failures = failures;
save();
console.log(`\n${failures} failing step(s); log docs/wallet-e2e.json`);
process.exit(failures ? 1 : 0);
