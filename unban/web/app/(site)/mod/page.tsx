import { Suspense } from "react";

import { ModDesk } from "@/components/ModDesk";
import { Unavailable } from "@/components/Unavailable";
import { CONTRACT, deployed } from "@/lib/deployment";
import { allCourts, listAppeals, why } from "@/lib/read";
import type { AppealRow, Court } from "@/lib/types";

export const revalidate = 15;
export const metadata = { title: "Moderator desk" };

export default async function ModPage() {
  let courts: Court[] = [];
  let waiting: AppealRow[] = [];
  let ruled: AppealRow[] = [];
  let error = deployed ? "" : "The contract this site reads has not been deployed yet.";
  if (deployed) {
    try {
      courts = await allCourts();
      waiting = (await listAppeals(0, "WAITING", 0, 50)).items;
      ruled = (await listAppeals(0, "DONE", 0, 30)).items;
    } catch (e) {
      error = why(e);
    }
  }
  return (
    <section className="wrap" style={{ paddingTop: 40, display: "grid", gap: 16 }}>
      <span className="eyebrow">For moderators</span>
      <h1 style={{ margin: 0, fontSize: 36 }}>Moderator desk</h1>
      {error ? (
        <Unavailable message={error} deployLink={!deployed} />
      ) : (
        <Suspense>
          <ModDesk contract={CONTRACT} courts={courts} waiting={waiting} ruled={ruled} />
        </Suspense>
      )}
    </section>
  );
}
