import Link from "next/link";

import { AppealList } from "@/components/AppealList";
import { RulesTable } from "@/components/Rules";
import { Empty, Unavailable } from "@/components/States";
import { getCourt, listAppeals, load } from "@/lib/chain";
import { addressUrl } from "@/lib/config";
import { duration, gen, short, when } from "@/lib/format";

import { FundPool } from "./FundPool";

export const revalidate = 15;

export default async function CourtPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return <div className="wrap pt-12"><Empty>Courts are numbered from 1.</Empty></div>;
  const [court, appeals] = await Promise.all([load(() => getCourt(id)), load(() => listAppeals(id, "", 0, 50))]);
  if (!court.ok) return <div className="wrap pt-12"><Unavailable result={court} /></div>;
  const c = court.data;
  const forMember = c.counts.overturned + c.counts.defaulted;
  return (
    <div className="wrap pt-12">
      <span className="eyebrow">Court {c.id}</span>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[38px] font-bold tracking-tight">{c.name}</h1>
        <Link href={`/c/${c.id}/appeal`} className="btn primary">
          File an appeal
        </Link>
      </div>
      <p className="mt-2 text-[14px] text-[var(--ink-3)]">
        Opened {when(c.created_at)} by{" "}
        <a className="link font-mono" href={addressUrl(c.owner)} target="_blank" rel="noreferrer">
          {short(c.owner)}
        </a>{" "}
        · rules version {c.version}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Box label="Pool" value={`${gen(c.pool)} GEN`} sub={`${gen(c.reserved)} GEN reserved for open appeals`} />
        <Box label="Appeal fee" value={`${gen(c.appeal_fee)} GEN`} sub={`${gen(c.compensation)} GEN compensation`} />
        <Box label="Response window" value={`${c.response_hours} h`} sub="then the appeal is granted by default" />
        <Box label="Appeals" value={`${c.counts.total}`} sub={`${forMember} for the member, ${c.counts.reduced} reduced, ${c.counts.upheld} upheld`} />
        <Box label="Average answer" value={c.average_answer_seconds ? duration(c.average_answer_seconds) : "none yet"} sub={`${c.open_appeals} open now`} />
      </div>

      <h2 className="mt-12 text-[22px] font-semibold">Rules and ladder</h2>
      <p className="mt-1 text-[14px] text-[var(--ink-3)]">A rule not written here cannot be broken. Rules freeze while appeals are open.</p>
      <div className="mt-5">
        <RulesTable rules={c.rules} ladder={c.ladder} />
      </div>

      <h2 className="mt-12 text-[22px] font-semibold">Moderators</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {c.mods.map((m) => (
          <a key={m} className="chip" href={addressUrl(m)} target="_blank" rel="noreferrer">
            {short(m)}
          </a>
        ))}
      </div>

      <h2 className="mt-12 text-[22px] font-semibold">Appeals</h2>
      <div className="mt-4">
        {!appeals.ok ? <Unavailable result={appeals} /> : appeals.data.length === 0 ? <Empty>No appeal filed in this court yet.</Empty> : <AppealList rows={appeals.data} showCourt={false} />}
      </div>

      <h2 className="mt-12 text-[22px] font-semibold">Top up the pool</h2>
      <p className="mt-1 mb-4 text-[14px] text-[var(--ink-3)]">Anyone may fund it. Compensation for members comes from here.</p>
      <FundPool courtId={c.id} />
    </div>
  );
}

function Box({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-[22px] font-semibold">{value}</div>
      <div className="mt-1 text-[12px] text-[var(--ink-3)]">{sub}</div>
    </div>
  );
}
