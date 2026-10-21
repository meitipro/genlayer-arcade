import Link from "next/link";

import { RulesTable } from "@/components/Rules";
import { Empty, Unavailable } from "@/components/States";
import { getCourt, load } from "@/lib/chain";

import { AppealForm } from "./AppealForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "File an appeal" };

export default async function FileAppeal({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return <div className="wrap pt-12"><Empty>Courts are numbered from 1.</Empty></div>;
  const court = await load(() => getCourt(id));
  if (!court.ok) return <div className="wrap pt-12"><Unavailable result={court} /></div>;
  const c = court.data;
  return (
    <div className="wrap pt-12">
      <Link href={`/c/${c.id}`} className="eyebrow hover:text-[var(--ink)]">
        ← {c.name}
      </Link>
      <h1 className="mt-3 text-[36px] font-bold tracking-tight">File an appeal</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-[var(--ink-2)]">
        Say what happened in your own words. A moderator then has {c.response_hours} hours to answer with the rule and the
        quoted messages, or the appeal is granted by default. Appeals are public: never put personal data here.
      </p>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <AppealForm court={c} />
        <div>
          <span className="eyebrow">This court&apos;s rules</span>
          <div className="mt-4">
            <RulesTable rules={c.rules} ladder={c.ladder} />
          </div>
        </div>
      </div>
    </div>
  );
}
