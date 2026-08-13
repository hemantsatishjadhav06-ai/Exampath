import type { Metadata } from "next";
import KeyDatesTable from "@/components/KeyDatesTable";
import { ExamShell, loadExamCtx, notFound, tabMetaTitle } from "@/lib/exam-page";
import { t } from "@/lib/i18n";
import { getCycleChildren } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { locale: Locale; cycleId: string } }): Promise<Metadata> {
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) return {};
  const hi = params.locale === "hi";
  return pageMeta(params.locale, `/exam/${params.cycleId}/apply`,
    `${hi ? "आवेदन कैसे करें" : "How to Apply"} — ${tabMetaTitle(params.locale, ctx.cycle, "")}`,
    `Apply online for ${ctx.cycle.title}: official apply link, fees and key dates.`);
}

export default async function ApplyTab({ params }: { params: { locale: Locale; cycleId: string } }) {
  const locale = params.locale; const s = t(locale);
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) notFound();
  const { keyDates } = await getCycleChildren(ctx.cycle.id);
  const fees = ctx.exam?.fees ?? [];
  return (
    <ExamShell ctx={ctx} locale={locale} active="applyTab">
      <section className="card p-5">
        <h2 className="h2 mb-2">🚀 {locale === "hi" ? "आवेदन कैसे करें" : "How to apply"}</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] text-slate-600">
          <li>{locale === "hi" ? "आधिकारिक पोर्टल पर पंजीकरण करें" : "Register on the official application portal"}</li>
          <li>{locale === "hi" ? "फ़ॉर्म भरें व दस्तावेज़ अपलोड करें" : "Fill the form and upload photo/signature"}</li>
          <li>{locale === "hi" ? "शुल्क का ऑनलाइन भुगतान करें" : "Pay the fee online"}</li>
          <li>{locale === "hi" ? "सबमिट कर पुष्टि सुरक्षित रखें" : "Submit and save the confirmation"}</li>
        </ol>
        {ctx.cycle.apply_url && (
          <a href={ctx.cycle.apply_url} target="_blank" rel="noopener" className="btn-accent mt-4">{s.apply} ↗</a>
        )}
      </section>
      {fees.length > 0 && (
        <section className="card p-5">
          <h2 className="h2 mb-2">💳 {locale === "hi" ? "आवेदन शुल्क" : "Application fee"}</h2>
          <table className="w-full text-sm"><tbody>
            <tr className="text-left text-xs uppercase text-slate-400"><th className="py-1.5">Category</th><th>Fee</th><th>Notes</th></tr>
            {fees.map((f, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-2 font-bold">{f.category}</td>
                <td>{f.amount ? `₹${f.amount}` : "Free"}</td>
                <td className="text-slate-500">{f.notes ?? ""}</td>
              </tr>
            ))}
          </tbody></table>
        </section>
      )}
      <section className="card p-5"><h2 className="h2 mb-2">📌 {s.keyDates}</h2><KeyDatesTable keyDates={keyDates} locale={locale} /></section>
    </ExamShell>
  );
}
