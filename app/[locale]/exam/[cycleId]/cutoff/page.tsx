import type { Metadata } from "next";
import { ExamShell, loadExamCtx, notFound, tabMetaTitle } from "@/lib/exam-page";
import { t } from "@/lib/i18n";
import { getCycleChildren, getVacancyHistory } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";
import { inr } from "@/lib/format";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { locale: Locale; cycleId: string } }): Promise<Metadata> {
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) return {};
  const hi = params.locale === "hi";
  return pageMeta(params.locale, `/exam/${params.cycleId}/cutoff`,
    `${tabMetaTitle(params.locale, ctx.cycle, "")} ${hi ? "कट-ऑफ़" : "Cutoff"}`,
    `Category-wise cutoff marks and vacancy trend for ${ctx.cycle.title}.`);
}

export default async function CutoffTab({ params }: { params: { locale: Locale; cycleId: string } }) {
  const locale = params.locale; const s = t(locale);
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) notFound();
  const [{ cutoffs }, history] = await Promise.all([
    getCycleChildren(ctx.cycle.id), getVacancyHistory(ctx.cycle.exam_slug),
  ]);
  const max = Math.max(1, ...cutoffs.map((c) => Number(c.marks ?? 0)));
  return (
    <ExamShell ctx={ctx} locale={locale} active="cutoff">
      <section className="card p-5">
        <h2 className="h2 mb-3">✂️ {locale === "hi" ? "श्रेणी-वार कट-ऑफ़" : "Category-wise cutoff"}</h2>
        {cutoffs.length === 0 && <p className="text-sm text-slate-400">{s.noData}</p>}
        <ul className="space-y-2.5">
          {cutoffs.map((c) => (
            <li key={c.id} className="flex items-center gap-3 text-sm">
              <b className="w-20 flex-none font-extrabold">{c.category}{c.phase ? ` · ${c.phase}` : ""}</b>
              <span className="w-14 flex-none">{c.marks ?? "—"}</span>
              <span className="h-2 flex-1 rounded-full bg-brand-50">
                <span className="block h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, (Number(c.marks ?? 0) / max) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>
      {history.length > 0 && (
        <section className="card p-5">
          <h2 className="h2 mb-3">📊 {locale === "hi" ? "रिक्ति प्रवृत्ति" : "Vacancy trend"}</h2>
          <div className="flex h-36 items-end gap-3">
            {history.map((v) => {
              const m = Math.max(...history.map((x) => x.seats));
              return (
                <div key={v.year} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-extrabold">{inr(v.seats)}</span>
                  <div className="w-full max-w-[46px] rounded-t-lg bg-gradient-to-t from-brand-700 to-brand-500" style={{ height: `${Math.max(8, (v.seats / m) * 100)}%` }} />
                  <span className="text-[11px] text-slate-500">{v.year}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </ExamShell>
  );
}
