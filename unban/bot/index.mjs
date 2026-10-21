/**
 * Unban's Discord bot. Every UNBAN_POLL_SECONDS it reads list_appeals for one
 * court (no wallet: reads are free and unsigned), and applies each new ruling
 * with the server's own bot token through Discord's REST API. It holds no
 * wallet key and signs no transaction. Applied appeal ids are kept in a state
 * file so nothing is applied twice.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

import { pending, plan } from "./logic.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const CONTRACT = env.UNBAN_CONTRACT ?? "";
const COURT = Number(env.UNBAN_COURT ?? 0);
const TOKEN = env.DISCORD_TOKEN ?? "";
const GUILD = env.DISCORD_GUILD ?? "";
const LOG_CHANNEL = env.DISCORD_LOG_CHANNEL ?? "";
const SITE = env.UNBAN_SITE ?? "https://use-unban.vercel.app";
const POLL = Math.max(15, Number(env.UNBAN_POLL_SECONDS ?? 60));
const STATE = env.UNBAN_STATE ?? path.join(HERE, ".applied.json");
const DRY = env.UNBAN_DRY_RUN === "1";

if (!/^0x[0-9a-fA-F]{40}$/.test(CONTRACT) || !(COURT > 0) || (!DRY && (!TOKEN || !GUILD))) {
  console.error("Set UNBAN_CONTRACT, UNBAN_COURT, DISCORD_TOKEN and DISCORD_GUILD (or UNBAN_DRY_RUN=1). See docs/reference/bot-config.");
  process.exit(2);
}

const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } } };
const reader = createClient({ chain });

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return [];
  }
}

function saveState(ids) {
  fs.writeFileSync(STATE, JSON.stringify(ids) + "\n");
}

async function discord(method, route, body) {
  if (DRY) {
    console.log(`  [dry run] ${method} ${route}${body ? " " + JSON.stringify(body) : ""}`);
    return { ok: true, status: 0 };
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://discord.com/api/v10${route}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json", "X-Audit-Log-Reason": "Unban ruling" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      const wait = Number((await res.json().catch(() => ({})))?.retry_after ?? 2);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    return res;
  }
  return { ok: false, status: 429 };
}

async function apply(row) {
  const p = plan(row);
  if (!p) return `#${row.id} ${row.status.toLowerCase()}: nothing to apply`;
  if (!p.user) return `#${row.id} ${p.text}, but the case names no Discord user id; apply it by hand`;
  if (p.unban) {
    const res = await discord("DELETE", `/guilds/${GUILD}/bans/${p.user}`);
    // 404 means the member was not banned (already lifted by hand): the ruling is still applied.
    if (!res.ok && res.status !== 404) throw new Error(`unban ${p.user} failed with HTTP ${res.status}`);
  }
  if (p.timeoutSeconds) {
    const until = new Date(Date.now() + p.timeoutSeconds * 1000).toISOString();
    const res = await discord("PATCH", `/guilds/${GUILD}/members/${p.user}`, { communication_disabled_until: until });
    // 404: an unbanned member has to rejoin before a timeout can be set; the ban is already lifted.
    if (!res.ok && res.status !== 404) throw new Error(`timeout ${p.user} failed with HTTP ${res.status}`);
  }
  return `#${row.id} ${p.text} for <@${p.user}>`;
}

async function tick() {
  const raw = await reader.readContract({ address: CONTRACT, functionName: "list_appeals", args: [COURT, "", 0, 50] });
  const rows = typeof raw === "string" ? JSON.parse(raw) : raw;
  const applied = loadState();
  for (const row of pending(rows, applied)) {
    try {
      const line = await apply(row);
      console.log(line);
      if (LOG_CHANNEL) await discord("POST", `/channels/${LOG_CHANNEL}/messages`, { content: `${line} · ${SITE}/a/${row.id}`, allowed_mentions: { parse: [] } });
      applied.push(row.id);
      saveState(applied);
    } catch (error) {
      console.error(`#${row.id}: ${error.message}; will retry next poll`);
    }
  }
}

console.log(`unban bot: court ${COURT} on ${CONTRACT}, every ${POLL}s${DRY ? " (dry run)" : ""}`);
for (;;) {
  try {
    await tick();
  } catch (error) {
    console.error(`read failed: ${String(error?.message ?? error).slice(0, 160)}`);
  }
  await new Promise((r) => setTimeout(r, POLL * 1000));
}
