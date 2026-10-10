import type { Metadata } from "next";
import { addressUrl, explorerBase } from "@/lib/explorer";
import deployment from "@/lib/deployment.json";
import { GAMES } from "@/lib/games";

export const metadata: Metadata = { title: "How it works" };

const NAMES: Record<string, string> = {
  VERDICT_CONTRACT: "DailyVerdict",
  BRIDGE_CONTRACT: "WordBridge",
  ORACLE_CONTRACT: "OracleGuess",
  LEDGER_CONTRACT: "SeasonLedger",
};

export default function How() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <h1 className="text-[28px] font-bold">How GenLayer Arcade works</h1>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Arcade games</h2>
        <p className="text-muted">
          Arcade scores never touch the chain. Each run starts a signed one-use session; the score is checked against the game&apos;s limits (a cap, a minimum run time, a maximum rate) and stored in Redis on weekly season boards. Client games cannot be made cheat-proof, so admins can also remove outliers.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Daily on-chain games</h2>
        <p className="text-muted">
          Daily Verdict, Word Bridge and Oracle Guess run on Intelligent Contracts on {deployment.network === "studionet" ? "GenLayer Studionet" : deployment.network}. Your entry is sent by the hub&apos;s relayer account, which pays the fee, so you only need a nickname. Every result links to the explorer.
        </p>
        <ul className="space-y-2 text-sm">
          {GAMES.filter((g) => g.type === "onchain").map((g) => (
            <li key={g.slug} className="card p-3">
              <p className="font-semibold">{g.title}</p>
              <p className="text-muted">{g.concept}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Seasons</h2>
        <p className="text-muted">Seasons are ISO weeks in UTC. Every Monday the top 10 of each arcade game is written to the SeasonLedger contract, a deterministic owner-only record.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contracts</h2>
        <ul className="mono space-y-1 text-xs">
          {Object.entries(deployment.contracts).map(([k, v]) =>
            v ? (
              <li key={k}>
                {NAMES[k]}{" "}
                <a className="break-all text-accent" href={addressUrl(v)} target="_blank" rel="noreferrer">
                  {v}
                </a>
              </li>
            ) : null,
          )}
        </ul>
        <p className="text-xs text-muted">
          Explorer: <a href={explorerBase} className="text-accent">{explorerBase}</a>. Source code and tests: <a className="text-accent" href="https://github.com/meitipro/genlayer-arcade">github.com/meitipro/genlayer-arcade</a>.
        </p>
      </section>
    </div>
  );
}
