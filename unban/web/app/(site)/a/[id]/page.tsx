import Link from "next/link";

import { Verdict } from "@/components/Badge";
import { Empty, Unavailable } from "@/components/States";
import { getAppeal, getCourt, load } from "@/lib/chain";
import { addressUrl } from "@/lib/config";
import { duration, gen, short, when } from "@/lib/format";

import { Actions, Withdraw } from "./Actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Appeal ${(await params).id}` };
}

export default async function AppealPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return <div className="wrap pt-12"><Empty>Appeals are numbered from 1.</Empty></div>;
  const appeal = await load(() => getAppeal(id));
  if (!appeal.ok) return <div className="wrap pt-12"><Unavailable result={appeal} /></div>;
  const a = appeal.data;
  const court = await load(() => getCourt(a.court_id));
  const ruled = ["UPHELD", "REDUCED", "OVERTURNED", "DEFAULTED"].includes(a.status);
  const bot =
    a.status === "OVERTURNED" || a.status === "DEFAULTED"
      ? "lifts the ban"
      : a.status === "REDUCED"
        ? `replaces the ban with ${a.new_level}, ${a.new_level_label}`
        : a.status === "UPHELD"
          ? "leaves the ban in place"
          : "waits for the ruling";

  return (
    <div className="wrap grid gap-8 pt-12 lg:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">
            Appeal #{a.id} · <Link href={`/c/${a.court_id}`}>{a.court_name}</Link>
          </span>
          <Verdict status={a.status} level={a.new_level} />
        </div>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">{a.case_ref}</h1>
        <p className="-mt-2 font-mono text-[12px] text-[var(--ink-3)]">banned {a.banned_on} · rules version {a.version}</p>

        <Block title="Member's appeal" meta={`${short(a.member)} · ${when(a.filed_at)}`} metaHref={addressUrl(a.member)}>
          <p className="whitespace-pre-wrap text-[15px] text-[var(--ink-2)]">{a.statement}</p>
        </Block>

        {a.answered_at > 0 ? (
          <Block title="Moderator's answer" meta={`${short(a.moderator)} · ${duration(a.answered_at - a.filed_at)} later`} metaHref={addressUrl(a.moderator)}>
            <p className="text-[14px] text-[var(--ink-2)]">
              Rule cited <b className="text-[var(--ink)]">{a.rule}, {a.rule_text}</b> · penalty applied <b className="text-[var(--ink)]">{a.level}, {a.level_label}</b>
            </p>
            <div className="quote mt-3">{a.evidence}</div>
          </Block>
        ) : a.status === "FILED" ? (
          <p className="note grey">
            Waiting for a moderator. They have until {when(a.respond_by)}; after that anyone can grant the appeal by default.
          </p>
        ) : null}

        {a.reply ? (
          <Block title="Member's reply" meta="once, within 24 h">
            <p className="whitespace-pre-wrap text-[15px] text-[var(--ink-2)]">{a.reply}</p>
          </Block>
        ) : a.status === "ANSWERED" ? (
          <p className="note grey">The member may reply once until {when(a.reply_by)}. Judging opens after the reply or when that window ends.</p>
        ) : null}

        {ruled && (
          <div className={`panel p-5 ${a.status === "OVERTURNED" || a.status === "DEFAULTED" ? "border-[var(--amber)]" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Verdict status={a.status} level={a.new_level} />
              <span className="font-mono text-[12px] text-[var(--ink-3)]">
                {a.status === "DEFAULTED" ? "no answer in the window" : "validators agreed"} · {when(a.ruled_at)}
              </span>
            </div>
            <p className="mt-3 text-[15px]">
              {a.status === "DEFAULTED" ? `No moderator answered within ${duration(a.respond_by - a.filed_at)}, so the appeal was granted without a judgment.` : a.reason}
            </p>
            {a.status === "REDUCED" && (
              <p className="mt-2 font-mono text-[12px] text-[var(--amber)]">
                New penalty {a.new_level}: {a.new_level_label}
              </p>
            )}
          </div>
        )}

        <Actions a={a} />
      </div>

      <aside className="flex flex-col gap-4">
        <div className="panel p-5">
          <span className="eyebrow">Settlement</span>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[14px]">
            <dt className="text-[var(--ink-3)]">Appeal fee</dt>
            <dd className="text-right font-mono">{gen(a.fee)} GEN</dd>
            <dt className="text-[var(--ink-3)]">Compensation reserved</dt>
            <dd className="text-right font-mono">{gen(a.reserved)} GEN</dd>
            {ruled && (
              <>
                <dt className="text-[var(--ink-3)]">To the member</dt>
                <dd className="text-right font-mono text-[var(--amber)]">{gen(a.to_member)} GEN</dd>
                <dt className="text-[var(--ink-3)]">To the pool</dt>
                <dd className="text-right font-mono">{gen(a.to_pool)} GEN</dd>
              </>
            )}
            <dt className="text-[var(--ink-3)]">Member&apos;s balance now</dt>
            <dd className="text-right font-mono">{gen(a.member_balance)} GEN</dd>
          </dl>
          <div className="mt-4">
            <Withdraw member={a.member} balance={a.member_balance} />
          </div>
        </div>
        <div className="panel p-5">
          <span className="eyebrow">What the bot applies</span>
          <p className="mt-3 text-[14px] text-[var(--ink-2)]">
            The {a.court_name} bot reads this ruling and {bot}. It holds no wallet key and signs nothing.
          </p>
        </div>
        {court.ok && (
          <div className="panel p-5">
            <span className="eyebrow">{court.data.name}</span>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[14px]">
              <dt className="text-[var(--ink-3)]">Appeals</dt>
              <dd className="text-right">{court.data.counts.total}</dd>
              <dt className="text-[var(--ink-3)]">Overturned or defaulted</dt>
              <dd className="text-right">{court.data.counts.overturned + court.data.counts.defaulted}</dd>
              <dt className="text-[var(--ink-3)]">Average answer</dt>
              <dd className="text-right">{court.data.average_answer_seconds ? duration(court.data.average_answer_seconds) : "none yet"}</dd>
              <dt className="text-[var(--ink-3)]">Pool</dt>
              <dd className="text-right">{gen(court.data.pool)} GEN</dd>
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}

function Block({ title, meta, metaHref, children }: { title: string; meta?: string; metaHref?: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow">{title}</span>
        {meta &&
          (metaHref ? (
            <a className="font-mono text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)]" href={metaHref} target="_blank" rel="noreferrer">
              {meta}
            </a>
          ) : (
            <span className="font-mono text-[12px] text-[var(--ink-3)]">{meta}</span>
          ))}
      </div>
      {children}
    </section>
  );
}
