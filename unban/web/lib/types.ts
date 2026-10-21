/** The JSON shapes the contract's three views return (contracts/unban.py). */

export type Status = "FILED" | "ANSWERED" | "UPHELD" | "REDUCED" | "OVERTURNED" | "DEFAULTED";

export type Rule = { text: string; first: string; repeat: string };

export type Court = {
  id: number;
  name: string;
  owner: string;
  mods: string[];
  rules: Rule[];
  ladder: string[];
  version: number;
  rules_from_day: number;
  appeal_fee: string;
  compensation: string;
  response_hours: number;
  pool: string;
  reserved: string;
  open_appeals: number;
  created_at: number;
  counts: { total: number; upheld: number; reduced: number; overturned: number; defaulted: number };
  average_answer_seconds: number;
  owner_balance: string;
};

export type AppealRow = {
  id: number;
  court_id: number;
  court_name: string;
  member: string;
  case_ref: string;
  banned_on: string;
  status: Status;
  level: string;
  new_level: string;
  new_level_label: string;
  reason: string;
  filed_at: number;
  answered_at: number;
  ruled_at: number;
  respond_by: number;
  reply_by: number;
};

export type Appeal = AppealRow & {
  statement: string;
  moderator: string;
  rule: number;
  rule_text: string;
  level_label: string;
  evidence: string;
  reply: string;
  replied_at: number;
  version: number;
  rules: Rule[];
  ladder: string[];
  prior: number;
  fee: string;
  reserved: string;
  to_member: string;
  to_pool: string;
  member_balance: string;
  judge_ready: boolean;
  default_ready: boolean;
};

export const RULED: Status[] = ["UPHELD", "REDUCED", "OVERTURNED"];
