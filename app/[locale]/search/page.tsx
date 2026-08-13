import type { Metadata } from "next";
import ExamCard from "@/components/ExamCard";
import SearchFilterForm from "@/components/SearchFilterForm";
import { t } from "@/lib/i18n";
import { getBodies, getCategories, getCycles } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  const hi = params.locale === "hi";
  return pageMeta(params.locale, "/search",
    hi ? "परीक्षा खोजें व पात्रता जाँचें" : "Search Exams & Check Eligibility",
    hi ? "शिक्षा, आयु और संस्था के अनुसार सरकारी परीक्षाएँ खोजें।" : "Filter Indian government exams by education, age and conducting body — see exactly what you're eligible for.");
}

const QRANK: Record<string, number> = { "10th": 1, "12th": 2, graduate: 3, pg: 4 };

export default async function SearchPage({ params, searchParams }: {
  params: { locale: Locale };
  searchParams: Record<string, string | undefined>;
}) {
  const locale = params.locale;
  const s = t(locale);
  const { qualification, age, body, category } = searchParams;
  const [bodies, categories, cycles] = await Promise.all([
    getBodies(), getCategories(),
    getCycles({ body: body || undefined, category: category || undefined }),
  ]);
  const bodyMap = new Map(bodies.map((b) => [b.slug, b]));

  // education: user qualifies for exams whose requirement <= their level
  let rows = cycles;
  if (qualification && QRANK[qualification]) {
    const { getExam } = await import("@/lib/queries");
    const examMeta = new Map<string, string>();
    await Promise.all(Array.from(new Set(rows.map((c) => c.exam_slug))).map(async (slug) => {
      const e = await getExam(slug);
      if (e) examMeta.set(slug, e.qualification_code);
    }));
    rows = rows.filter((c) => (QRANK[examMeta.get(c.exam_slug) ?? ""] ?? 9) <= QRANK[qualification]);
  }
  const ageN = age ? parseInt(age, 10) : null;
  if (ageN && !Number.isNaN(ageN)) {
    rows = rows.filter((c) => c.age_min != null && c.age_max != null && ageN >= c.age_min && ageN <= c.age_max);
  }

  const active = rows.filter((c) => c.application_state === "active");
  const upcoming = rows.filter((c) => {
    if (c.application_state !== "upcoming" || !c.application_start) return false;
    const inMonths = (new Date(c.application_start).getTime() - Date.now()) / 2_592_000_000;
    return inMonths <= 6;
  });
  const other = rows.filter((c) => !active.includes(c) && !upcoming.includes(c));

  const Col = ({ title, items }: { title: string; items: typeof rows }) => (
    <section aria-label={title}>
      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-500">{title} ({items.length})</h2>
      <div className="flex flex-col gap-4">
        {items.length === 0 && <p className="card p-4 text-sm text-slate-400">{s.noData}</p>}
        {items.map((c) => <ExamCard key={c.id} cycle={c} body={bodyMap.get(c.body_slug)} locale={locale} />)}
      </div>
    </section>
  );

  return (
    <div className="wrap py-8">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{s.searchCta}</h1>
      <SearchFilterForm locale={locale} bodies={bodies} categories={categories}
        defaults={{ qualification, age, body, category }} />
      <p className="mt-4 text-sm font-bold text-slate-600">
        {rows.length} {locale === "hi" ? "परीक्षाएँ मिलीं" : "exams match"}
      </p>
      <div className="mt-5 grid gap-8 lg:grid-cols-3">
        <Col title={s.activeExams} items={active} />
        <Col title={s.upcomingExams} items={upcoming} />
        <Col title={locale === "hi" ? "अन्य" : "Other"} items={other} />
      </div>
    </div>
  );
}
