import type { Status } from "@/lib/types";

const CLASS: Record<Status, string> = {
  OVERTURNED: "overturned",
  REDUCED: "reduced",
  UPHELD: "upheld",
  DEFAULTED: "defaulted",
  FILED: "waiting",
  ANSWERED: "waiting",
};

const LABEL: Record<Status, string> = {
  OVERTURNED: "Overturned",
  REDUCED: "Reduced",
  UPHELD: "Upheld",
  DEFAULTED: "Defaulted",
  FILED: "Awaiting answer",
  ANSWERED: "Answered",
};

export function Verdict({ status, level }: { status: Status; level?: string }) {
  return (
    <span className={`badge ${CLASS[status]}`}>
      {LABEL[status]}
      {status === "REDUCED" && level ? ` · ${level}` : ""}
    </span>
  );
}
