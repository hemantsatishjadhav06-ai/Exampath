import type { Metadata } from "next";
import { ExamShell, loadExamCtx, notFound, tabMetaTitle } from "@/lib/exam-page";
import { pick, t } from "@/lib/i18n";
import { pageMeta, jsonLd } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { locale: Locale; cycleId: string } }): Promise<Metadata> {
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) return {};
  const hi = params.locale === "hi";
  return pageMeta(params.locale, `/exam/${params.cycleId}/syllabus`,
    `${tabMetaTitle(params.locale, ctx.cycle, "")} ${hi ? "पाठ्यक्रम" : "Syllabus"}`,
    `Subject-wise syllabus for ${ctx.cycle.title}.`);
}

export default async function SyllabusTab({ params }: { params: { locale: Locale; cycleId: string } }) {
  const locale = params.locale; const s = t(locale);
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) notFound();
  const syllabus = ctx.exam?.syllabus ?? [];
  const faqs = (ctx.exam?.faqs ?? []).slice(0, 8);
  const faqLd = faqs.length ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: pick(locale, f.q, f.q_hi), acceptedAnswer: { "@type": "Answer", text: pick(locale, f.a, f.a_hi) } })),
  } : null;
  return (
    <ExamShell ctx={ctx} locale={locale} active="syllabus">
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd) }} />}
      {syllabus.length === 0 && <p className="card p-6 text-center text-slate-400">{s.noData}</p>}
      {syllabus.map((sub, i) => (
        <details key={i} className="card p-4" open={i === 0}>
          <summary className="cursor-pointer text-[15px] font-extrabold">
            {pick(locale, sub.subject, sub.subject_hi)}
            <span className="pill ml-2 bg-brand-50 text-brand-700">{sub.topics?.length ?? 0} topics</span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {(locale === "hi" && sub.topics_hi?.length ? sub.topics_hi : sub.topics ?? []).map((tp, j) => (
              <span key={j} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12.5px] font-medium text-slate-600">{tp}</span>
            ))}
          </div>
        </details>
      ))}
      {faqs.length > 0 && (
        <section className="card p-5">
          <h2 className="h2 mb-2">❓ FAQs</h2>
          {faqs.map((f, i) => (
            <details key={i} className="border-b border-slate-100 py-2 last:border-0">
              <summary className="cursor-pointer text-sm font-bold">{pick(locale, f.q, f.q_hi)}</summary>
              <p className="mt-1.5 text-sm text-slate-600">{pick(locale, f.a, f.a_hi)}</p>
            </details>
          ))}
        </section>
      )}
    </ExamShell>
  );
}
