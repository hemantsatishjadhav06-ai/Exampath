// Types mirroring data/exams.json — the single source of truth the app renders.

export type QualCode = "10th" | "12th" | "graduate" | "pg";

export type Status =
  | "application_open"
  | "closing_soon"
  | "upcoming"
  | "admit_card"
  | "result_awaited"
  | "result_out"
  | "completed";

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
  date: string | null; // ISO (YYYY-MM-DD) or null
  done: boolean;
}

export interface KeyDate {
  label: string;
  date: string; // ISO
  is_deadline: boolean;
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
}

export interface Update {
  text: string;
  kind: string;
  when: string;
}

export interface Cycle {
  id: string;
  body: string; // body slug
  exam: string;
  title: string;
  qualification: string;
  qualification_code: QualCode;
  status: Status;
  vacancy: number;
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
};
