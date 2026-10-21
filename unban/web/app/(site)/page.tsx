import Link from "next/link";

import { AppealCard } from "@/components/AppealCard";
import { Verdict } from "@/components/Badge";
import { getAppeal, listAppeals, load } from "@/lib/chain";
import type { Appeal, AppealRow } from "@/lib/types";

export const revalidate = 30;

const STEPS = [
  ["Rules", "The community writes numbered rules and a penalty ladder once, lists its moderators and funds a pool."],
  ["Appeal", "A banned member files the case and a statement, with the appeal fee."],
  ["Evidence", "A listed moderator answers with the rule, the penalty applied and the quoted messages."],
  ["Ruling", "The member may reply once. Validators rule by the written rules; a bot applies the result."],
];

const PAYS: [string, string, string, string][] = [
  ["OVERTURNED", "The evidence does not show the cited rule, or any written rule, broken", "Fee back plus compensation from the pool", "Bot lifts the ban"],
  ["REDUCED", "A rule was broken, but the ladder sets a lighter penalty than the one applied", "Fee back", "Bot replaces the ban with the ladder's level"],
  ["UPHELD", "The evidence shows the cited rule broken and the penalty fits the ladder", "Fee goes to the pool", "Ban stays"],
  ["DEFAULTED", "No moderator answered within the response window", "Fee back plus compensation", "Bot lifts the ban, never judged"],
];

const FAQ: [string, string][] = [
  ["Who decides?", "GenLayer validators. Each one reads the same rules, the moderator's record and the member's appeal, and a ruling stands only when they agree on the verdict and, for a reduced ban, on the ladder level. No moderator, owner or Unban operator can change it."],
  ["What if the quote is fake?", "The judge cannot read the chat, so it treats the quotes as accurate unless the moderator's own record contradicts them. Every quote sits in public next to the moderator's address, and the member's one reply is where a quote gets disputed."],
  ["What can the bot do?", "Read rulings and apply them in the server with the server's own bot token: lift a ban, or replace it with the ladder's lighter level. It holds no wallet key and signs nothing."],
  ["Which network?", "GenLayer Studio Next, chain 61997. Reads need no wallet; every write is signed in your browser."],
  ["Does it cover Discord's own rules?", "No. Unban covers a community's own written rules, not a platform's terms of service."],
];

export default async function Home() {
  const recent = await load(() => listAppeals(0, "ruled", 0, 4));
  const rows: AppealRow[] = recent.ok ? recent.data : [];
  const featuredRow = rows.find((r) => r.status === "OVERTURNED") ?? rows[0];
  const featured = featuredRow ? await load(() => getAppeal(featuredRow.id)) : null;
  const card: Appeal | null = featured && featured.ok ? featured.data : null;

  return (
    <>
      <section className="wrap grid gap-10 pt-16 pb-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <span className="eyebrow amber">Ban appeals, ruled on GenLayer</span>
          <h1 className="mt-5 text-[44px] font-bold leading-[1.02] tracking-tight sm:text-[60px]">
            Every ban gets <span className="text-[var(--amber)]">a fair second look.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-[var(--ink-2)]">
            Communities write their rules and penalties once. Banned members appeal with a small fee, moderators show the
            evidence, and GenLayer validators rule by the written rules. A bot applies the result.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/courts" className="btn primary">
              Browse courts
            </Link>
            <Link href="/new" className="btn">
              Open a court
            </Link>
          </div>
          <p className="mt-6 font-mono text-[12px] text-[var(--ink-3)]">Right about the ban? The fee comes back, with compensation.</p>
        </div>
        <div>
          {card ? (
            <AppealCard a={card} />
          ) : (
            <div className="panel p-6">
              <span className="eyebrow">Live appeal card</span>
              <p className="mt-4 text-[15px] text-[var(--ink-2)]">
                {recent.ok
                  ? "No appeal has been ruled on chain yet. The first ruling appears here, with its quote, the rule cited and where the money went."
                  : recent.reason === "not_deployed"
                    ? "The contract address is not configured on this deployment yet, so there is no ruling on chain to show."
                    : "The chain could not be read just now, so no live ruling is shown rather than a stale one."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Verdict status="OVERTURNED" />
                <Verdict status="REDUCED" level="P2" />
                <Verdict status="UPHELD" />
                <Verdict status="DEFAULTED" />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="wrap">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-[var(--line)] py-4">
          <span className="eyebrow">Recent rulings</span>
          {rows.length === 0 && <span className="text-[13px] text-[var(--ink-3)]">None yet.</span>}
          {rows.map((r) => (
            <Link key={r.id} href={`/a/${r.id}`} className="flex items-center gap-2 text-[13px]">
              <Verdict status={r.status} level={r.new_level} />
              <b className="text-[var(--ink)]">{r.court_name}</b>
              <span className="max-w-[16rem] truncate text-[var(--ink-3)]">{r.case_ref}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap mt-16">
        <span className="eyebrow">How it works</span>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, text], i) => (
            <div key={title}>
              <div className="font-mono text-[13px] text-[var(--amber)]">0{i + 1}</div>
              <h3 className="mt-2 text-[20px] font-semibold">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap mt-20">
        <span className="eyebrow">Who pays when</span>
        <h2 className="mt-3 text-[30px] font-semibold tracking-tight">The fee and the compensation, in each ruling</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Ruling</th>
                <th>Meaning</th>
                <th>Money</th>
                <th>In the server</th>
              </tr>
            </thead>
            <tbody>
              {PAYS.map(([status, meaning, money, server]) => (
                <tr key={status}>
                  <td>
                    <Verdict status={status as AppealRow["status"]} level={status === "REDUCED" ? "P2" : undefined} />
                  </td>
                  <td>{meaning}</td>
                  <td>{money}</td>
                  <td>{server}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-[var(--ink-3)]">
          Compensation is reserved from the pool when an appeal is filed, so a ruling for the member is never unpaid. If the
          pool is empty the appeal still runs, with the fee as the only money at stake, and the form says so.
        </p>
      </section>

      <section className="wrap mt-20 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <span className="eyebrow">For moderators</span>
          <h2 className="mt-3 text-[30px] font-semibold tracking-tight">Write the rules once. Answer with evidence. Let the ruling back you up.</h2>
        </div>
        <div className="grid gap-4 text-[15px] text-[var(--ink-2)]">
          <p>
            A court is its rules: up to twelve numbered rules, a ladder of up to six penalties, and for each rule the level
            for a first offence and for a repeat. Rules freeze while appeals are open, and a change only applies to bans made
            after it.
          </p>
          <p>
            The moderator desk lists waiting appeals oldest first with the hours left. Pick the rule and the level from the
            court&apos;s own lists, paste the messages, and the ruling that follows is public, next to your address. Good calls
            get upheld in public; nobody argues in DMs.
          </p>
          <Link href="/mod" className="btn self-start">
            Open the moderator desk
          </Link>
        </div>
      </section>

      <section className="wrap mt-20">
        <span className="eyebrow">FAQ</span>
        <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <h3 className="text-[17px] font-semibold">{q}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
