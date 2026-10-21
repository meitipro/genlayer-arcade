/**
 * The network and the contract. Studio Next only (chain 61997, 0xF22D); no
 * environment variable can point a page at another network. The contract
 * address comes from NEXT_PUBLIC_UNBAN_CONTRACT, which scripts/deploy.py
 * prints, so the site holds no second copy of it.
 */

export const CHAIN_ID = 61997;
export const CHAIN_HEX = "0xf22d";
export const CHAIN_NAME = "GenLayer Studio Next";
export const RPC = "https://studio-next.genlayer.com/api";
export const EXPLORER = "https://explorer-studio-dev.genlayer.com";
export const REPO = "https://github.com/meitipro/genlayer-unban";

export const CONTRACT = (process.env.NEXT_PUBLIC_UNBAN_CONTRACT ?? "").trim() as `0x${string}` | "";
export const IS_LIVE = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT);

export const GEN = 10n ** 18n;

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;

/** What a wallet needs to add Studio Next. */
export const WALLET_CHAIN = {
  chainId: CHAIN_HEX,
  chainName: CHAIN_NAME,
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: [RPC],
  blockExplorerUrls: [EXPLORER],
};
