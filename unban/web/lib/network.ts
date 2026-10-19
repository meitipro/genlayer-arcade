/**
 * Studio Next, the only network Unban runs on. No chain or file imports, so
 * client components can use it.
 */
export const CHAIN_ID = 61997;
export const CHAIN_HEX = "0xf22d";
export const CHAIN_NAME = "GenLayer Studio Next";
export const RPC = "https://studio-next.genlayer.com/api";
export const EXPLORER = "https://explorer-studio-dev.genlayer.com";
export const GEN = 10n ** 18n;
export const REPO = "https://github.com/meitipro/genlayer-unban";
export const REPO_EDIT = "https://github.com/meitipro/genlayer-unban/blob/main/web/content/docs";

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;
