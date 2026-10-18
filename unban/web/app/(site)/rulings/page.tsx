import { RulingRow } from "@/components/RulingRow";
import { Empty, Unavailable } from "@/components/Unavailable";
import { deployed } from "@/lib/deployment";
import { listAppeals, why } from "@/lib/read";
import type { Page } from "@/lib/types";

export const revalidate = 15;
export const metadata = { title: "Rulings" };

export default async function Rulings({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(0, Number((await searchParams).page ?? 0) || 0);
  let data: Page | null = null;
  let error = "";
  if (deployed) {
    try {
      data = await listAppeals(0, "DONE", page * 25, 25);
    } catch (e) {
      error = why(e);
    }
  }
  return (
    <section className="wrap" style={{ paddingTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>
      <span className="eyebrow">Rulings</span>
      <h1 style={{ margin: 0, fontSize: 36 }}>Every resolved appeal, across courts</h1>
      <p className="muted" style={{ margin: 0 }}>Upheld bans are listed beside overturned ones. Each row links to the full record.</p>
      {!deployed ? (
        <Unavailable message="The contract this site reads has not been deployed yet." deployLink />
      ) : error ? (
        <Unavailable message={error} />
      ) : !data || data.items.length === 0 ? (
        <Empty>No appeal has been resolved yet.</Empty>
      ) : (
        <>
          <div className="grid" style={{ gap: 8 }}>{data.items.map((r) => <RulingRow key={r.id} a={r} />)}</div>
          <div style={{ display: "flex", gap: 10 }}>
            {page > 0 ? <a className="btn sm" href={`/rulings?page=${page - 1}`}>Newer</a> : null}
            {(page + 1) * 25 < data.total ? <a className="btn sm" href={`/rulings?page=${page + 1}`}>Older</a> : null}
          </div>
        </>
      )}
    </section>
  );
}
