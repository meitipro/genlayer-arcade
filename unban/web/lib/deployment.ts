import record from "@/generated/deployment.json";

type Record = { address?: string; deploy_tx?: string; source_sha256?: string; deployed_from_commit?: string; deployed_at?: string };

const fromFile = record as Record;

/**
 * The Unban contract this site reads and writes. The repository's
 * deployment.json (written by scripts/deploy.py) is the source of truth; the
 * environment variable exists for a deployment made from /deploy before the
 * file is committed.
 */
export const CONTRACT: string = (process.env.NEXT_PUBLIC_UNBAN_CONTRACT || fromFile.address || "").trim();
export const DEPLOY_TX: string = CONTRACT === fromFile.address ? fromFile.deploy_tx || "" : "";
export const SOURCE_SHA256: string = fromFile.source_sha256 || "";
export const deployed = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT);
