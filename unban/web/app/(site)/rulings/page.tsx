import { AppealList } from "@/components/AppealList";
import { Empty, Unavailable } from "@/components/States";
import { listAppeals, load } from "@/lib/chain";

export const revalidate = 30;
export const metadata = { title: "Rulings" };

export default async function Rulings() {
  const [ruled, defaulted] = await Promise.all([load(() => listAppeals(0, "ruled", 0, 50)), load(() => listAppeals(0, "defaulted", 0, 50))]);
  return (
    <div className="wrap pt-12">
      <span className="eyebrow">Rulings</span>
      <h1 className="mt-3 text-[36px] font-bold tracking-tight">Every ruling, upheld ones included</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-[var(--ink-2)]">
        Newest first, across all courts. Each one links to the full record: the appeal, the moderator&apos;s quotes, the
        reply and the validators&apos; reason.
      </p>
      <div className="mt-8">
        {!ruled.ok ? <Unavailable result={ruled} /> : ruled.data.length === 0 ? <Empty>No appeal has been ruled yet.</Empty> : <AppealList rows={ruled.data} />}
      </div>
      {defaulted.ok && defaulted.data.length > 0 && (
        <div className="mt-12">
          <span className="eyebrow">Defaulted, never judged</span>
          <div className="mt-4">
            <AppealList rows={defaulted.data} />
          </div>
        </div>
      )}
    </div>
  );
}
