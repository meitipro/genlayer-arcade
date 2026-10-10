// lib/wallet.ts: optional wallet mode (section 20, "Optional wallet connect so
// players can submit dailies from their own address"). A wallet plays under a
// name derived from its address, so the name is bound to the signer: the hub
// only records a wallet entry whose transaction was sent from that address.
export const WALLET_NAME_RE = /^w_[0-9a-f]{18}$/;

export function walletName(address: string): string {
  return `w_${address.toLowerCase().replace(/^0x/, "").slice(0, 18)}`;
}

export const STUDIONET = {
  chainId: 61999,
  chainIdHex: "0xf22f",
  chainName: "GenLayer Studionet",
  rpc: "https://studio.genlayer.com/api",
  explorer: "https://explorer-studio.genlayer.com",
};
