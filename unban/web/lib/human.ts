/**
 * Every failure a page can meet, as a sentence a person can act on (the
 * approach of Fieldwork's and Recourse's humanError). The consensus class
 * prefix is for validators comparing failures, not for people.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Advice = { text: string; action?: "install" | "retry" | "switch" | "faucet" };

export function humanError(raw: unknown): Advice {
  const error = raw as any;
  const code = error?.code ?? error?.data?.originalError?.code ?? error?.cause?.code;
  const text = String(error?.message ?? error ?? "").replace(/^Error:\s*/i, "");
  if (text === "no_wallet") return { text: "No wallet was found in this browser. Install MetaMask or another EVM wallet, reload, and connect.", action: "install" };
  if (code === 4001 || code === "ACTION_REJECTED" || /user rejected|user denied|denied transaction/i.test(text))
    return { text: "You cancelled that in your wallet. Nothing was sent.", action: "retry" };
  if (text === "wrong_network") return { text: "Your wallet is on another network. Switch it to Studio Next (chain 61997) to continue.", action: "switch" };
  if (/insufficient funds|exceeds balance|insufficient_balance/i.test(text))
    return { text: "This wallet does not hold enough GEN for the amount and the fee deposit. Use Get test GEN in the header.", action: "faucet" };
  if (/fetch failed|failed to fetch|networkerror|ECONNRESET|timed out|timeout|503|502|504|-32029|rate limit/i.test(text))
    return { text: "Studio Next is not answering right now. Nothing was spent. Try again in a minute.", action: "retry" };
  const cleaned = text.replace(/\[(EXPECTED|LLM_ERROR)\]\s*/g, "").trim();
  return { text: cleaned ? `The contract refused this: ${cleaned}` : "The chain refused this without a reason.", action: "retry" };
}
