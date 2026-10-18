/**
 * Unban's Discord bot. Reads rulings, applies them with the server's own bot
 * token, and holds no wallet key: it cannot sign, file, or move money.
 *
 *   UNBAN_CONTRACT=0x... UNBAN_COURT=1 DISCORD_TOKEN=... DISCORD_GUILD=... npm start
 *
 * See web/content/docs/reference/bot-configuration.mdx for every variable.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

import { DEFAULT_LEVELS, findBanned, handleOf, plan } from "./rules.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(HERE, "state.json");
const RPC = "https://studio-next.genlayer.com/api";
const DISCORD = "https://discord.com/api/v10";

function contractAddress() {
  if (process.env.UNBAN_CONTRACT) return process.env.UNBAN_CONTRACT;
  try {
    return JSON.parse(fs.readFileSync(path.join(HERE, "..", "deployment.json"), "utf8")).address;
  } catch {
    return "";
  }
}

const CONTRACT = contractAddress();
const COURT = Number(process.env.UNBAN_COURT);
const TOKEN = process.env.DISCORD_TOKEN ?? "";
const GUILD = process.env.DISCORD_GUILD ?? "";
const LEVELS = process.env.UNBAN_LEVELS ? JSON.parse(process.env.UNBAN_LEVELS) : DEFAULT_LEVELS;
const POLL = Math.max(15, Number(process.env.UNBAN_POLL_SECONDS ?? 60)) * 1000;
const DRY = process.env.UNBAN_DRY_RUN === "1";

for (const [name, ok] of [["UNBAN_CONTRACT", /^0x[0-9a-fA-F]{40}$/.test(CONTRACT)], ["UNBAN_COURT", COURT > 0], ["DISCORD_TOKEN", DRY || TOKEN], ["DISCORD_GUILD", DRY || GUILD]]) {
  if (!ok) {
    console.error(`missing or invalid ${name}`);
    process.exit(2);
  }
}

const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: [RPC] } } };
const reader = createClient({ chain });
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { applied: {} };
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");

async function discord(method, route, body) {
  if (DRY) {
    console.log(`  [dry run] ${method} ${route}${body ? " " + JSON.stringify(body) : ""}`);
    return method === "GET" ? [] : null;
  }
  const response = await fetch(DISCORD + route, {
    method,
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json", "X-Audit-Log-Reason": "Unban ruling" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 429) {
    const wait = Number((await response.json().catch(() => ({}))).retry_after ?? 2);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return discord(method, route, body);
  }
  if (!response.ok && response.status !== 404) throw new Error(`${method} ${route} -> ${response.status} ${await response.text()}`);
  return response.status === 204 || response.status === 404 ? null : response.json();
}

async function tick() {
  const page = JSON.parse(String(await reader.readContract({ address: CONTRACT, functionName: "list_appeals", args: [COURT, "DONE", 0, 50] })));
  const todo = page.items.filter((a) => !state.applied[a.id]).reverse();
  if (!todo.length) return;
  const bans = DRY ? [] : await discord("GET", `/guilds/${GUILD}/bans?limit=1000`);
  for (const appeal of todo) {
    const handle = handleOf(appeal.case_ref);
    const step = plan(appeal, LEVELS);
    const user = findBanned(bans ?? [], handle);
    const record = { status: appeal.status, level: appeal.new_level, handle, at: new Date().toISOString() };
    if (step.unban) {
      if (user) {
        await discord("DELETE", `/guilds/${GUILD}/bans/${user.id}`);
        if (step.then?.kind === "timeout") {
          const until = new Date(Date.now() + step.then.minutes * 60_000).toISOString();
          // A member who has not rejoined cannot be timed out yet; the ruling is still recorded.
          await discord("PATCH", `/guilds/${GUILD}/members/${user.id}`, { communication_disabled_until: until }).catch((e) => (record.note = String(e.message).slice(0, 120)));
        }
        record.done = step.then ? `unbanned, then ${step.then.kind}` : "unbanned";
      } else {
        record.done = DRY ? "dry run" : "no banned user with that handle";
      }
    } else {
      record.done = step.note ?? "ban stays";
    }
    state.applied[appeal.id] = record;
    save();
    console.log(`appeal #${appeal.id} ${appeal.status}${appeal.new_level ? " " + appeal.new_level : ""} ${handle}: ${record.done}`);
  }
}

console.log(`Unban bot: contract ${CONTRACT}, court ${COURT}${DRY ? ", dry run" : ""}. Read only; no wallet key.`);
for (;;) {
  try {
    await tick();
  } catch (error) {
    console.error(`read failed, trying again next round: ${String(error?.message ?? error).slice(0, 160)}`);
  }
  await new Promise((r) => setTimeout(r, POLL));
}
