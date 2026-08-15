// Bundled REAL dataset (verified, official-source checked) used until Supabase
// is provisioned. Activated by DATA_MODE=seed or when Supabase env is absent.
// scripts/seed-supabase.mjs loads this exact data into Supabase — no drift.
import raw from "@/db/seed.json";
import practiceRaw from "@/db/practice.json";
import type {
  Body, CategoryRow, Cutoff, Cycle, CycleLink, Exam, KeyDate, Paper, PracticeSet, Stage, StateRow, Update, VacancyYear,
} from "@/lib/types";

const db = raw as unknown as {
  states: StateRow[]; categories: CategoryRow[]; bodies: Body[]; exams: Exam[];
  exam_cycles: Cycle[]; stages: Stage[]; key_dates: KeyDate[]; cutoffs: Cutoff[];
  cycle_links: CycleLink[]; updates: Update[]; vacancy_history: VacancyYear[]; papers?: Paper[];
};

const today = () => new Date().toISOString().slice(0, 10);
const withState = (c: Cycle): Cycle => ({
  ...c,
  application_state:
    c.application_start && c.application_end && today() >= c.application_start && today() <= c.application_end
      ? "active"
      : c.application_start && today() < c.application_start
      ? "upcoming"
      : "other",
});

export const seed = {
  bodies: (): Body[] => db.bodies,
  body: (slug: string): Body | null => db.bodies.find((b) => b.slug === slug) ?? null,
  states: (): StateRow[] => db.states,
  categories: (): CategoryRow[] => db.categories,
  exam: (slug: string): Exam | null => db.exams.find((e) => e.slug === slug) ?? null,
  cycles: (filter?: { body?: string; exam?: string; qualification?: string; category?: string; state?: string }): Cycle[] => {
    let rows = db.exam_cycles.map(withState);
    if (filter?.body) rows = rows.filter((c) => c.body_slug === filter.body);
    if (filter?.exam) rows = rows.filter((c) => c.exam_slug === filter.exam);
    if (filter?.qualification || filter?.category || filter?.state) {
      const exam = new Map(db.exams.map((e) => [e.slug, e]));
      const body = new Map(db.bodies.map((b) => [b.slug, b]));
      rows = rows.filter((c) => {
        const e = exam.get(c.exam_slug); const b = body.get(c.body_slug);
        if (filter.qualification && e?.qualification_code !== filter.qualification) return false;
        if (filter.category && e?.category_slug !== filter.category) return false;
        if (filter.state && b?.state_slug !== filter.state) return false;
        return true;
      });
    }
    return rows.sort((a, z) => (a.application_end ?? "9999").localeCompare(z.application_end ?? "9999"));
  },
  cycle: (id: string): Cycle | null => {
    const c = db.exam_cycles.find((x) => x.id === id);
    return c ? withState(c) : null;
  },
  popular: (limit: number): Cycle[] =>
    db.exam_cycles.map(withState)
      .sort((a, z) => (a.popularity_rank_14d ?? 999) - (z.popularity_rank_14d ?? 999)).slice(0, limit),
  children: (cycleId: string) => ({
    stages: db.stages.filter((s) => s.cycle_id === cycleId).sort((a, z) => a.sort_order - z.sort_order),
    keyDates: db.key_dates.filter((k) => k.cycle_id === cycleId).sort((a, z) => a.sort_order - z.sort_order),
    cutoffs: db.cutoffs.filter((c) => c.cycle_id === cycleId).sort((a, z) => a.sort_order - z.sort_order),
    links: db.cycle_links.filter((l) => l.cycle_id === cycleId),
    updates: db.updates.filter((u) => u.cycle_id === cycleId && u.status !== "rejected")
      .sort((a, z) => z.published_at.localeCompare(a.published_at)).slice(0, 12),
  }),
  visibleUpdates: (limit: number): (Update & { cycle?: Cycle })[] => {
    const byId = new Map(db.exam_cycles.map((c) => [c.id, withState(c)]));
    return db.updates.filter((u) => u.status !== "rejected")
      .sort((a, z) => z.published_at.localeCompare(a.published_at)).slice(0, limit)
      .map((u) => ({ ...u, cycle: byId.get(u.cycle_id) }));
  },
  keyDatesForMonth: (year: number, month1: number): (KeyDate & { cycle?: Cycle })[] => {
    const p = `${year}-${String(month1).padStart(2, "0")}-`;
    const byId = new Map(db.exam_cycles.map((c) => [c.id, withState(c)]));
    return db.key_dates.filter((k) => k.date.startsWith(p))
      .sort((a, z) => a.date.localeCompare(z.date))
      .map((k) => ({ ...k, cycle: byId.get(k.cycle_id) }));
  },
  vacancyHistory: (examSlug: string): VacancyYear[] =>
    db.vacancy_history.filter((v) => v.exam_slug === examSlug).sort((a, z) => a.year - z.year),
  papers: (filter?: { exam?: string; year?: number; kind?: string }): Paper[] => {
    let rows = db.papers ?? [];
    if (filter?.exam) rows = rows.filter((p) => p.exam_slug === filter.exam);
    if (filter?.year) rows = rows.filter((p) => p.year === filter.year);
    if (filter?.kind) rows = rows.filter((p) => p.kind === filter.kind);
    return rows;
  },
  practiceSets: (): PracticeSet[] => (practiceRaw as { sets: PracticeSet[] }).sets,
  practiceSet: (id: number): PracticeSet | null =>
    (practiceRaw as { sets: PracticeSet[] }).sets.find((s) => s.id === id) ?? null,
};

export const seedActive = (): boolean =>
  process.env.DATA_MODE === "seed" || !process.env.NEXT_PUBLIC_SUPABASE_URL;
