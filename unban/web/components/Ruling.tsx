import type { Status } from "@/lib/types";

const LABEL: Record<Status, string> = {
  FILED: "Waiting",
  ANSWERED: "Answered",
  UPHELD: "Upheld",
  REDUCED: "Reduced",
  OVERTURNED: "Overturned",
  DEFAULTED: "Defaulted",
};

export function Ruling({ status, level }: { status: Status; level?: string }) {
  return (
    <span className={`ruling ${status}`}>
      {LABEL[status]}
      {status === "REDUCED" && level ? ` · ${level}` : ""}
    </span>
  );
}

/** What each outcome means for the money and for the bot. One table, used everywhere. */
export const OUTCOMES: { status: Status; meaning: string; money: string; bot: string }[] = [
  { status: "OVERTURNED", meaning: "The evidence does not show the cited rule, or any written rule, broken.", money: "Fee back plus compensation from the pool", bot: "Lifts the ban" },
  { status: "REDUCED", meaning: "A rule was broken, but the ladder sets a lighter penalty than the one applied.", money: "Fee back", bot: "Replaces the ban with the ladder's penalty" },
  { status: "UPHELD", meaning: "The evidence shows the cited rule broken and the penalty fits the ladder.", money: "Fee goes to the pool", bot: "The ban stays" },
  { status: "DEFAULTED", meaning: "No moderator answered within the response window.", money: "Fee back plus compensation", bot: "Lifts the ban, never judged" },
];
