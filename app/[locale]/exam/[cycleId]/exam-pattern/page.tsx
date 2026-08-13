import type { Metadata } from "next";
import { ExamShell, loadExamCtx, notFound, tabMetaTitle } from "@/lib/exam-page";
import { pick, t } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { locale: Locale; cycleId: string } }): Promise<Metadata> {
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) return {};
  const hi = params.locale === "hi";
  return pageMeta(params.locale, `/exam/${params.cycleId}/exam-pattern`,
    `${tabMetaTitle(params.locale, ctx.cycle, "")} ${hi ? "परीक्षा पैटर्न" : "Exam Pattern"}`,
    `Stage-wise pattern for ${ctx.cycle.title}: sections, marks, duration, negative marking.`);
}

export default async function PatternTab({ params }: { params: { locale: Locale; cycleId: string } }) {
  const locale = params.locale; const s = t(locale);
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) notFound();
  const pattern = ctx.exam?.pattern ?? [];
  return (
    <ExamShell ctx={ctx} locale={locale} active="pattern">
      {pattern.length === 0 && <p className="card p-6 text-center text-slate-400">{s.noData}</p>}
      {pattern.map((st, i) => (
        <section key={i} className="card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="h2">{pick(locale, st.stage_name, st.stage_name_hi)}</h2>
            {st.duration_minutes != null && <span className="pill bg-brand-50 text-brand-700">⏱ {st.duration_minutes} min</span>}
            {st.total_marks != null && <span className="pill bg-brand-50 text-brand-700">🎯 {st.total_marks} marks</span>}
            {st.negative_marking_note && <span className="pill bg-red-50 text-red-600">− {st.negative_marking_note}</span>}
          </div>
          {st.sections && st.sections.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm"><tbody>
                <tr className="text-left text-xs uppercase text-slate-400"><th className="py-1.5">Section</th><th>Questions</th><th>Marks</th></tr>
                {st.sections.map((sec, j) => (
                  <tr key={j} className="border-t border-slate-100">
                    <td className="py-2 font-bold">{sec.name}</td><td>{sec.questions ?? "—"}</td><td>{sec.marks ?? "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 font-extrabold">
                  <td className="py-2">Total</td>
                  <td>{st.sections.reduce((a, x) => a + (x.questions ?? 0), 0)}</td>
                  <td>{st.sections.reduce((a, x) => a + (x.marks ?? 0), 0)}</td>
                </tr>
              </tbody></table>
            </div>
          )}
        </section>
      ))}
    </ExamShell>
  );
}
