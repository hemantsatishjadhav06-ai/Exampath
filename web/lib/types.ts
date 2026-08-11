// Types mirroring data/exams.json — the single source of truth the app renders.

export type QualCode = "10th" | "12th" | "graduate" | "pg";

export type Status =
  | "application_open"
  | "closing_soon"
  | "upcoming"
  | "admit_card"
  | "result_awaited"
  | "result_out"
  | "completed"
  | "exam_scheduled";

export type VerificationStatus = "verified" | "partially_verified" | "unverified";

export interface SourceEvidence {
  status: VerificationStatus;
  source_name: string;
  source_url: string;
  source_type: "notification" | "corrigendum" | "calendar" | "result" | "official_page";
  published_at?: string;
  checked_at: string;
  notes?: string;
}

export interface Body {
  slug: string;
  name: string;
  short: string;
  level: string;
  color: string;
  official_url: string;
}

export interface Stage {
  name: string;
  date: string | null;
  done: boolean;
  precision?: "day" | "month" | "tentative";
}

export interface KeyDate {
  label: string;
  date: string;
  is_deadline: boolean;
  precision?: "day" | "month" | "tentative";
}

export interface VacancyPoint {
  year: number;
  seats: number;
}

export interface Cutoff {
  category: string;
  marks: number;
}

export interface LinkItem {
  label: string;
  url: string;
  kind: string;
  verified?: boolean;
}

export interface Update {
  text: string;
  kind: string;
  when: string;
  published_at?: string;
  source_url?: string;
}

export interface Cycle {
  id: string;
  body: string;
  exam: string;
  title: string;
  qualification: string;
  qualification_code: QualCode;
  status: Status;
  vacancy: number;
  vacancy_note?: string;
  age_min: number;
  age_max: number;
  summary: string;
  posts: string;
  stages: Stage[];
  dates: KeyDate[];
  selection: string[];
  vacancy_history: VacancyPoint[];
  cutoffs: Cutoff[];
  links: LinkItem[];
  updates: Update[];
  related: string[];
  verification?: SourceEvidence;
}

export interface ExamData {
  generated_at: string;
  source: string;
  bodies: Body[];
  cycles: Cycle[];
}

export interface DeadlineHit {
  cycle: Cycle;
  date: KeyDate;
}

export interface SearchArgs {
  q?: string;
  age?: number | null;
  qual?: QualCode | null;
  body?: string | null;
  closingSoon?: boolean;
}

export const QUAL_RANK: Record<QualCode, number> = {
  "10th": 1,
  "12th": 2,
  graduate: 3,
  pg: 4,
};

export const STATUS_META: Record<Status, { cls: string; label: string }> = {
  application_open: { cls: "p-open", label: "Applications Open" },
  closing_soon: { cls: "p-soon", label: "Closing Soon" },
  upcoming: { cls: "p-up", label: "Upcoming" },
  admit_card: { cls: "p-admit", label: "Admit Card Out" },
  result_awaited: { cls: "p-admit", label: "Result Awaited" },
  result_out: { cls: "p-result", label: "Result Out" },
  completed: { cls: "p-done", label: "Completed" },
  exam_scheduled: { cls: "p-admit", label: "Exam Scheduled" },
};
