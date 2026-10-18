import Link from "next/link";

import { AppealForm } from "@/components/AppealForm";
import { RulesView } from "@/components/RulesView";
import { Unavailable } from "@/components/Unavailable";
import { CONTRACT, deployed } from "@/lib/deployment";
import { getCourt, why } from "@/lib/read";
import type { Court } from "@/lib/types";

export const revalidate = 15;
export const metadata = { title: "File an appeal" };

export default async function FileAppeal({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  let court: Court | null = null;
  let error = deployed ? "" : "The contract this site reads has not been deployed yet.";
  if (deployed) {
    try {
      court = await getCourt(id);
    } catch (e) {
      error = why(e);
    }
  }
  if (!court) return <section className="wrap" style={{ paddingTop: 40 }}><Unavailable message={error} deployLink={!deployed} /></section>;
  return (
    <section className="wrap" style={{ paddingTop: 40, display: "grid", gap: 24 }}>
      <div>
        <Link href={`/c/${court.id}`} className="eyebrow" style={{ textDecoration: "none" }}>← {court.name}</Link>
        <h1 style={{ margin: "6px 0 0", fontSize: 36 }}>File an appeal</h1>
        <p className="muted" style={{ margin: "8px 0 0", maxWidth: 640 }}>
          Your appeal is judged only by the rules below. A moderator has {court.response_hours} hours to answer with the rule and the quoted
          messages; you may reply once within 24 hours; then anyone can ask the validators to rule.
        </p>
      </div>
      <AppealForm contract={CONTRACT} court={court} />
      <details className="card pad">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>The rules of {court.name}</summary>
        <div style={{ marginTop: 14 }}><RulesView rules={court.rules} ladder={court.ladder} /></div>
      </details>
    </section>
  );
}
