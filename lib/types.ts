// Row shapes mirroring db/schema.sql (source of truth — do not invent fields).
export interface StateRow { slug: string; name: string; name_hi: string | null; sort_order: number }
export interface CategoryRow { slug: string; name: string; name_hi: string | null; icon: string | null; sort_order: number }
export interface Body {
  slug: string; name: string; name_hi: string | null; short_name: string;
  level: "central" | "state"; state_slug: string | null; color: string;
  logo_url: string | null; official_url: string | null;
  description: string | null; description_hi: string | null;
  views_alltime: number; popularity_rank: number | null;
}
export interface Exam {
  slug: string; body_slug: string; category_slug: string | null;
  name: string; name_hi: string | null;
  qualification_code: "10th" | "12th" | "graduate" | "pg";
  description: string | null; description_hi: string | null; official_url: string | null;
  syllabus: SyllabusSubject[]; pattern: PatternStage[]; fees: FeeRow[]; faqs: Faq[];
}
export interface SyllabusSubject { subject: string; subject_hi?: string; topics: string[]; topics_hi?: string[] }
export interface PatternStage {
  stage_name: string; stage_name_hi?: string; duration_minutes?: number; total_marks?: number;
  negative_marking_note?: string; sections?: { name: string; questions?: number; marks?: number }[];
}
export interface FeeRow { category: string; amount: number; notes?: string }
export interface Faq { q: string; q_hi?: string; a: string; a_hi?: string }
export interface Cycle {
  id: string; exam_slug: string; body_slug: string; title: string; title_hi: string | null;
  status: string; vacancy: number; vacancy_note: string | null;
  age_min: number | null; age_max: number | null; age_relaxation_note: string | null;
  summary: string | null; summary_hi: string | null; posts: string | null; posts_hi: string | null;
  schedule_note: string | null; application_start: string | null; application_end: string | null;
  apply_url: string | null; views_14d: number; popularity_rank_14d: number | null;
  application_state?: "active" | "upcoming" | "other";
}
export interface Stage { id: number; cycle_id: string; name: string; name_hi: string | null; date: string | null; done: boolean; precision: string | null; sort_order: number }
export interface KeyDate { id: number; cycle_id: string; label: string; label_hi: string | null; date: string; is_deadline: boolean; precision: string | null; sort_order: number }
export interface Cutoff { id: number; cycle_id: string; category: string; phase: string | null; marks: number | null; sort_order: number }
export interface CycleLink { id: number; cycle_id: string; label: string; label_hi: string | null; url: string; kind: string; verified: boolean }
export interface Update {
  id: number; cycle_id: string; text: string; text_hi: string | null; kind: string;
  tab_link: string; status: "unverified" | "auto_verified" | "manual_verified" | "rejected";
  published_at: string;
}
export interface VacancyYear { id: number; exam_slug: string; year: number; seats: number }
