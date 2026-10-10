// lib/explorer.ts: links into the GenLayer explorer for every on-chain result.
import deployment from "./deployment.json";

const BASE = (process.env.NEXT_PUBLIC_EXPLORER || deployment.explorer || "https://explorer-studio.genlayer.com").replace(/\/$/, "");
const withScheme = BASE.startsWith("http") ? BASE : `https://${BASE}`;

export const explorerBase = withScheme;
export const txUrl = (hash: string) => `${withScheme}/tx/${hash}`;
export const addressUrl = (address: string) => `${withScheme}/address/${address}`;
