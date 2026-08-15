import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { getExam, getPapers } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  const hi = params.locale === "hi";
  return pageMeta(params.locale, "/papers",
    hi ? "पाठ्यक्रम व पिछले वर्षों के पेपर (2017–2026)" : "Syllabus & Previous-Year Papers (2017–2026)",
    hi ? "आधिकारिक पाठ्यक्रम PDF व उत्तर कुंजियाँ — जिनमें पिछले पेपर के वास्तविक प्रश्न होते हैं — 10 वर्षों का संग्रह।"
       : "Official syllabus PDFs and answer keys (which contain the actual past-paper questions) — a 10-year archive with year-wise filtering.");
}

const KIND_LABEL: Record<string, string> = {
  syllabus: "📚 Syllabus", answer_key: "📝 Answer Key (past paper)", result: "🏆 Result", notice: "ℹ️ Notice",
};

export default async function PapersPage({ params, searchParams }: {
  params: { locale: Locale }; searchParams: { year?: string; exam?: string };
}) {
  const locale = params.locale;
  const s = t(locale);
  const yearN = searchParams.year ? parseInt(searchParams.year, 10) : undefined;
  const all = await getPapers({ year: Number.isNaN(yearN) ? undefined : yearN, exam: searchParams.exam || undefined });
  const years = Array.from(new Set((await getPapers()).map((p) => p.year).filter(Boolean) as number[])).sort((a, z) => z - a);
  const examSlugs = Array.from(new Set(all.map((p) => p.exam_slug).filter(Boolean) as string[]));
  const examNames = new Map<string, string>();
  await Promise.all(examSlugs.map(async (slug) => {
    const e = await getExam(slug);
    examNames.set(slug, e?.name ?? slug);
  }));

  const grouped = new Map<string, typeof all>();
  for (const p of all) {
    const key = p.exam_slug ?? "__archive";
    grouped.set(key, [...(grouped.get(key) ?? []), p]);
  }
  const qs = (y?: number) => {
    const u = new URLSearchParams();
    if (y) u.set("year", String(y));
    if (searchParams.exam) u.set("exam", searchParams.exam);
    const str = u.toString();
    return str ? `?${str}` : "";
  };

  return (
    <div className="wrap py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">
        📄 {locale === "hi" ? "पाठ्यक्रम व पिछले पेपर" : "Syllabus & previous-year papers"}
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        {locale === "hi"
          ? "आधिकारिक स्रोत के लिंक — उत्तर कुंजी PDF में उस वर्ष के वास्तविक प्रश्न-पत्र होते हैं। हम PDF होस्ट नहीं करते।"
          : "Official-source links — answer-key PDFs contain that year's actual question papers. We never host the PDFs ourselves."}
      </p>
      {/* Year filter (2017–2026) */}
      <div className="scrollbar-none -mx-1 mt-5 flex gap-2 overflow-x-auto px-1">
        <a href={`?${searchParams.exam ? `exam=${searchParams.exam}` : ""}`}
          className={`flex-none rounded-full border px-4 py-1.5 text-[13px] font-bold ${!yearN ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
          {locale === "hi" ? "सभी वर्ष" : "All years"}
        </a>
        {years.map((y) => (
          <a key={y} href={qs(y)}
            className={`flex-none rounded-full border px-4 py-1.5 text-[13px] font-bold ${yearN === y ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-200"}`}>
            {y}
          </a>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {all.length === 0 && <p className="card p-10 text-center text-slate-400">{s.noData}</p>}
        {Array.from(grouped.entries()).map(([key, items]) => (
          <section key={key} className="card p-5">
            <h2 className="h2 mb-3">
              {key === "__archive" ? (locale === "hi" ? "🗄 सामान्य संग्रह (SSC)" : "🗄 SSC archive") : examNames.get(key) ?? key}
              <span className="pill ml-2 bg-brand-50 text-brand-700">{items.length}</span>
            </h2>
            <ul className="divide-y divide-slate-100">
              {items.slice(0, 40).map((p) => (
                <li key={p.id}>
                  <a href={p.url} target="_blank" rel="noopener" className="flex items-start gap-3 py-2.5 hover:bg-slate-50">
                    <span className="pill mt-0.5 flex-none bg-slate-100 text-slate-600">{p.year ?? "—"}</span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{p.title}</span>
                    <span className="flex-none text-xs font-bold text-brand-700">{KIND_LABEL[p.kind] ?? p.kind} ↗</span>
                  </a>
                </li>
              ))}
            </ul>
            {items.length > 40 && <p className="mt-2 text-xs text-slate-400">+{items.length - 40} more — filter by year to narrow.</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
