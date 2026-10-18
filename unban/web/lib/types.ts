export type Rule = { text: string; first: number; repeat: number };

export type Court = {
  id: number;
  courts: number;
  owner: string;
  name: string;
  rules: Rule[];
  ladder: string[];
  rules_from: string;
  versions: number;
  mods: string[];
  appeal_fee: string;
  compensation: string;
  response_hours: number;
  pool: string;
  reserved: string;
  open_appeals: number;
  created_at: number;
  appeals: number;
  upheld: number;
  reduced: number;
  overturned: number;
  defaulted: number;
  answered: number;
  avg_answer_seconds: number;
};

export type Status = "FILED" | "ANSWERED" | "UPHELD" | "REDUCED" | "OVERTURNED" | "DEFAULTED";

export type AppealRow = {
  id: number;
  court_id: number;
  court: string;
  member: string;
  case_ref: string;
  ban_date: string;
  status: Status;
  filed_at: number;
  respond_by: number;
  fee: string;
  reserved: string;
  rule: number;
  level: number;
  new_level: string;
  reason: string;
  answered_at: number;
  reply_by: number;
  replied: boolean;
  ruled_at: number;
  moderator: string;
  statement: string;
};

export type Appeal = AppealRow & {
  evidence: string;
  reply: string;
  replied_at: number;
  earlier: number;
  rules: Rule[];
  ladder: string[];
  rules_from: string;
  member_balance: string;
};

export type Page = { total: number; courts: number; appeals: number; items: AppealRow[] };

export const RESOLVED: Status[] = ["UPHELD", "REDUCED", "OVERTURNED", "DEFAULTED"];
