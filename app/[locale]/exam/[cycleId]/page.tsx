import type { Metadata } from "next";
import KeyDatesTable from "@/components/KeyDatesTable";
import TimelineStepper from "@/components/TimelineStepper";
import UpdatesFeed3Column from "@/components/UpdatesFeed3Column";
import FaqAccordion from "@/components/FaqAccordion";
import SimilarExams from "@/components/SimilarExams";
import { ExamShell, loadExamCtx, notFound, tabMetaTitle } from "@/lib/exam-page";
import { pick, t } from "@/lib/i18n";
import { getBodies, getCycleChildren, getCycles } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { locale: Locale; cycleId: string } }): Promise<Metadata> {
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) return {};
  const hi = params.locale === "hi";
  return pageMeta(params.locale, `/exam/${params.cycleId}`,
    `${tabMetaTitle(params.locale, ctx.cycle, "")} — ${hi ? "तिथियाँ, रिक्तियाँ, पात्रता" : "Dates, Vacancy, Eligibility"}`,
    ctx.cycle.summary ?? `${ctx.cycle.title}: dates, vacancies, eligibility and official links.`);
}

export default async function ExamOverview({ params }: { params: { locale: Locale; cycleId: string } }) {
  const locale = params.locale;
  const s = t(locale);
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) notFound();
  const [{ stages, keyDates, updates }, siblings, bodies] = await Promise.all([
    getCycleChildren(ctx.cycle.id),
    ctx.exam?.category_slug ? getCycles({ category: ctx.exam.category_slug }) : Promise.resolve([]),
    getBodies(),
  ]);
  const similar = siblings.filter((c) => c.id !== ctx.cycle.id);
  const bodyMap = new Map(bodies.map((b) => [b.slug, b]));
  return (
    <ExamShell ctx={ctx} locale={locale} active="overview">
      {ctx.cycle.summary && <p className="card p-4 text-[15px] text-slate-600">{pick(locale, ctx.cycle.summary, ctx.cycle.summary_hi)}</p>}
      {stages.length > 0 && (
        <section className="card p-4"><h2 className="h2 mb-2">🧭 {s.timeline}</h2><TimelineStepper stages={stages} locale={locale} /></section>
      )}
      <section className="card p-4"><h2 className="h2 mb-2">📌 {s.keyDates}</h2><KeyDatesTable keyDates={keyDates} locale={locale} /></section>
      {updates.length > 0 && (
        <section><h2 className="h2 mb-3">🆕 {locale === "hi" ? "ताज़ा अपडेट" : "Latest updates"}</h2>
          <UpdatesFeed3Column updates={updates.map((u) => ({ ...u, cycle: ctx.cycle }))} locale={locale} /></section>
      )}
      {ctx.exam && <FaqAccordion faqs={ctx.exam.faqs ?? []} locale={locale} />}
      <SimilarExams cycles={similar} bodies={bodyMap} locale={locale} />
    </ExamShell>
  );
}
