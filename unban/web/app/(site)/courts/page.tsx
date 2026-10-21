import Link from "next/link";

import { Empty, Unavailable } from "@/components/States";
import { getCourts, load } from "@/lib/chain";
import { duration, gen } from "@/lib/format";

export const revalidate = 30;
export const metadata = { title: "Courts" };

export default async function Courts() {
  const result = await load(getCourts);
  return (
    <div className="wrap pt-12">
      <span className="eyebrow">Courts</span>
      <h1 className="mt-3 text-[36px] font-bold tracking-tight">Every community with an appeals court</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-[var(--ink-2)]">
        Rules, ladder, moderators, pool and ruling counts, read from the chain. No wallet needed.
      </p>
      <div className="mt-8 grid gap-4">
        {!result.ok && <Unavailable result={result} />}
        {result.ok && result.data.courts.length === 0 && (
          <Empty>
            No court has been opened yet. <Link className="link" href="/new">Open the first one</Link>.
          </Empty>
        )}
        {result.ok &&
          result.data.courts.map((c) => (
            <Link key={c.id} href={`/c/${c.id}`} className="panel grid gap-4 p-5 hover:border-[var(--line-2)] md:grid-cols-[1.4fr_repeat(4,1fr)] md:items-center">
              <div>
                <div className="eyebrow">Court {c.id}</div>
                <div className="mt-1 text-[19px] font-semibold">{c.name}</div>
                <div className="mt-1 text-[13px] text-[var(--ink-3)]">
                  {c.rules.length} rules · {c.ladder.length}-step ladder · {c.mods.length} moderator{c.mods.length === 1 ? "" : "s"}
                </div>
              </div>
              <Stat label="Pool" value={`${gen(c.pool)} GEN`} />
              <Stat label="Appeal fee" value={`${gen(c.appeal_fee)} GEN`} />
              <Stat label="Appeals" value={`${c.counts.total}`} sub={`${c.counts.overturned + c.counts.defaulted} for the member`} />
              <Stat label="Average answer" value={c.average_answer_seconds ? duration(c.average_answer_seconds) : "none yet"} />
            </Link>
          ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-[17px] font-semibold">{value}</div>
      {sub && <div className="text-[12px] text-[var(--ink-3)]">{sub}</div>}
    </div>
  );
}
