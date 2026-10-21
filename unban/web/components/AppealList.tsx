import Link from "next/link";

import { when } from "@/lib/format";
import type { AppealRow } from "@/lib/types";

import { Verdict } from "./Badge";

export function AppealList({ rows, showCourt = true }: { rows: AppealRow[]; showCourt?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="table min-w-[640px]">
        <thead>
          <tr>
            <th>#</th>
            {showCourt && <th>Court</th>}
            <th>Case</th>
            <th>Ruling</th>
            <th>Reason</th>
            <th>Filed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-mono">
                <Link className="link" href={`/a/${r.id}`}>
                  {r.id}
                </Link>
              </td>
              {showCourt && (
                <td>
                  <Link href={`/c/${r.court_id}`}>{r.court_name}</Link>
                </td>
              )}
              <td className="max-w-[18rem]">{r.case_ref}</td>
              <td>
                <Verdict status={r.status} level={r.new_level} />
              </td>
              <td className="max-w-[22rem] text-[13px]">{r.reason || (r.status === "DEFAULTED" ? "No moderator answered in time." : "")}</td>
              <td className="whitespace-nowrap font-mono text-[12px]">{when(r.filed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
