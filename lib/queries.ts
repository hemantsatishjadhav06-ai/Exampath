// Server-side data access. Every function tolerates a missing Supabase config
// (returns empty data) so the app renders empty states — never mock data.
import { supabase } from "@/lib/supabase/client";
import { seed, seedActive } from "@/lib/seed";
import type {
  Body, CategoryRow, Cutoff, Cycle, CycleLink, Exam, KeyDate, Stage, StateRow, Update, VacancyYear,
} from "@/lib/types";

const empty = <T,>(): T[] => [];

export async function getBodies(): Promise<Body[]> {
  if (seedActive() || !supabase) return seed.bodies();
  const { data } = await supabase.from("bodies").select("*")
    .order("popularity_rank", { ascending: true, nullsFirst: false });
  return (data as Body[]) ?? [];
}

export async function getBody(slug: string): Promise<Body | null> {
  if (seedActive() || !supabase) return seed.body(slug);
  const { data } = await supabase.from("bodies").select("*").eq("slug", slug).maybeSingle();
  return (data as Body) ?? null;
}

export async function getStates(): Promise<StateRow[]> {
  if (seedActive() || !supabase) return seed.states();
  const { data } = await supabase.from("states").select("*").order("sort_order");
  return (data as StateRow[]) ?? [];
}

export async function getCategories(): Promise<CategoryRow[]> {
  if (seedActive() || !supabase) return seed.categories();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (data as CategoryRow[]) ?? [];
}

export async function getExam(slug: string): Promise<Exam | null> {
  if (seedActive() || !supabase) return seed.exam(slug);
  const { data } = await supabase.from("exams").select("*").eq("slug", slug).maybeSingle();
  return (data as Exam) ?? null;
}

/** Cycles with the computed active/upcoming state (view: cycle_application_state). */
export async function getCycles(filter?: {
  body?: string; exam?: string; qualification?: string; category?: string; state?: string;
}): Promise<Cycle[]> {
  if (seedActive() || !supabase) return seed.cycles(filter);
  let q = supabase.from("cycle_application_state").select("*");
  if (filter?.body) q = q.eq("body_slug", filter.body);
  if (filter?.exam) q = q.eq("exam_slug", filter.exam);
  const { data } = await q.order("application_end", { ascending: true, nullsFirst: false });
  let rows = (data as Cycle[]) ?? [];
  // qualification / category / state need the exams + bodies join — fetch maps once
  if (filter?.qualification || filter?.category || filter?.state) {
    const [{ data: exams }, { data: bodies }] = await Promise.all([
      supabase.from("exams").select("slug,qualification_code,category_slug"),
      supabase.from("bodies").select("slug,state_slug"),
    ]);
    const exam = new Map((exams ?? []).map((e: any) => [e.slug, e]));
    const body = new Map((bodies ?? []).map((b: any) => [b.slug, b]));
    rows = rows.filter((c) => {
      const e = exam.get(c.exam_slug);
      const b = body.get(c.body_slug);
      if (filter.qualification && e?.qualification_code !== filter.qualification) return false;
      if (filter.category && e?.category_slug !== filter.category) return false;
      if (filter.state && b?.state_slug !== filter.state) return false;
      return true;
    });
  }
  return rows;
}

export async function getCycle(id: string): Promise<Cycle | null> {
  if (seedActive() || !supabase) return seed.cycle(id);
  const { data } = await supabase.from("cycle_application_state").select("*").eq("id", id).maybeSingle();
  return (data as Cycle) ?? null;
}

export async function getPopularCycles(limit = 9): Promise<Cycle[]> {
  if (seedActive() || !supabase) return seed.popular(limit);
  const { data } = await supabase.from("cycle_application_state").select("*")
    .order("popularity_rank_14d", { ascending: true, nullsFirst: false }).limit(limit);
  return (data as Cycle[]) ?? [];
}

export async function getCycleChildren(cycleId: string) {
  if (seedActive() || !supabase) return seed.children(cycleId);
  if (!supabase) return { stages: [] as Stage[], keyDates: [] as KeyDate[], cutoffs: [] as Cutoff[], links: [] as CycleLink[], updates: [] as Update[] };
  const [stages, keyDates, cutoffs, links, updates] = await Promise.all([
    supabase.from("stages").select("*").eq("cycle_id", cycleId).order("sort_order"),
    supabase.from("key_dates").select("*").eq("cycle_id", cycleId).order("sort_order"),
    supabase.from("cutoffs").select("*").eq("cycle_id", cycleId).order("sort_order"),
    supabase.from("cycle_links").select("*").eq("cycle_id", cycleId),
    supabase.from("visible_updates").select("*").eq("cycle_id", cycleId).limit(12),
  ]);
  return {
    stages: (stages.data as Stage[]) ?? [],
    keyDates: (keyDates.data as KeyDate[]) ?? [],
    cutoffs: (cutoffs.data as Cutoff[]) ?? [],
    links: (links.data as CycleLink[]) ?? [],
    updates: (updates.data as Update[]) ?? [],
  };
}

export async function getVisibleUpdates(limit = 45): Promise<(Update & { cycle?: Cycle })[]> {
  if (seedActive() || !supabase) return seed.visibleUpdates(limit);
  const { data } = await supabase.from("visible_updates").select("*").limit(limit);
  const ups = (data as Update[]) ?? [];
  const ids = Array.from(new Set(ups.map((u) => u.cycle_id)));
  if (!ids.length) return ups;
  const { data: cycles } = await supabase.from("exam_cycles").select("*").in("id", ids);
  const byId = new Map(((cycles as Cycle[]) ?? []).map((c) => [c.id, c]));
  return ups.map((u) => ({ ...u, cycle: byId.get(u.cycle_id) }));
}

export async function getKeyDatesForMonth(year: number, month1: number): Promise<(KeyDate & { cycle?: Cycle })[]> {
  if (seedActive() || !supabase) return seed.keyDatesForMonth(year, month1);
  const from = `${year}-${String(month1).padStart(2, "0")}-01`;
  const to = month1 === 12 ? `${year + 1}-01-01` : `${year}-${String(month1 + 1).padStart(2, "0")}-01`;
  const { data } = await supabase.from("key_dates").select("*").gte("date", from).lt("date", to).order("date");
  const rows = (data as KeyDate[]) ?? [];
  const ids = Array.from(new Set(rows.map((k) => k.cycle_id)));
  if (!ids.length) return rows;
  const { data: cycles } = await supabase.from("exam_cycles").select("*").in("id", ids);
  const byId = new Map(((cycles as Cycle[]) ?? []).map((c) => [c.id, c]));
  return rows.map((k) => ({ ...k, cycle: byId.get(k.cycle_id) }));
}

export async function getVacancyHistory(examSlug: string): Promise<VacancyYear[]> {
  if (seedActive() || !supabase) return seed.vacancyHistory(examSlug);
  const { data } = await supabase.from("vacancy_history").select("*").eq("exam_slug", examSlug).order("year");
  return (data as VacancyYear[]) ?? [];
}
