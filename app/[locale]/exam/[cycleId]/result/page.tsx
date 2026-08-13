import type { Metadata } from "next";
import LinkList from "@/components/LinkList";
import UpdatesFeed3Column from "@/components/UpdatesFeed3Column";
import { ExamShell, loadExamCtx, notFound, tabMetaTitle } from "@/lib/exam-page";
import { getCycleChildren } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { locale: Locale; cycleId: string } }): Promise<Metadata> {
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) return {};
  const hi = params.locale === "hi";
  return pageMeta(params.locale, `/exam/${params.cycleId}/result`,
    `${tabMetaTitle(params.locale, ctx.cycle, "")} ${hi ? "परिणाम / उत्तर कुंजी" : "Result & Answer Key"}`,
    `Result and answer-key links for ${ctx.cycle.title}.`);
}

export default async function ResultTab({ params }: { params: { locale: Locale; cycleId: string } }) {
  const locale = params.locale;
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) notFound();
  const { links, updates } = await getCycleChildren(ctx.cycle.id);
  const relevant = links.filter((l) => l.kind === "result" || l.kind === "answer_key");
  const relUpdates = updates.filter((u) => u.kind === "result" || u.kind === "answer_key");
  return (
    <ExamShell ctx={ctx} locale={locale} active="result">
      <section className="card p-5">
        <h2 className="h2 mb-2">🏆 {locale === "hi" ? "परिणाम व उत्तर कुंजी" : "Result & answer key links"}</h2>
        <LinkList links={relevant} locale={locale} />
      </section>
      {relUpdates.length > 0 && (
        <UpdatesFeed3Column updates={relUpdates.map((u) => ({ ...u, cycle: ctx.cycle }))} locale={locale} />
      )}
    </ExamShell>
  );
}
