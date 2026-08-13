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
  return pageMeta(params.locale, `/exam/${params.cycleId}/admit-card`,
    `${tabMetaTitle(params.locale, ctx.cycle, "")} ${hi ? "एडमिट कार्ड / सिटी सूचना" : "Admit Card & City Info"}`,
    `Admit card download links and exam-city intimation for ${ctx.cycle.title}.`);
}

export default async function AdmitCardTab({ params }: { params: { locale: Locale; cycleId: string } }) {
  const locale = params.locale;
  const ctx = await loadExamCtx(params.cycleId);
  if (!ctx) notFound();
  const { links, updates } = await getCycleChildren(ctx.cycle.id);
  const relevant = links.filter((l) => l.kind === "admit_card");
  const relUpdates = updates.filter((u) => u.kind === "admit_card" || u.kind === "city_intimation");
  return (
    <ExamShell ctx={ctx} locale={locale} active="admitCard">
      <section className="card p-5">
        <h2 className="h2 mb-2">🎫 {locale === "hi" ? "एडमिट कार्ड लिंक" : "Admit card links"}</h2>
        <LinkList links={relevant} locale={locale} />
      </section>
      {relUpdates.length > 0 && (
        <UpdatesFeed3Column updates={relUpdates.map((u) => ({ ...u, cycle: ctx.cycle }))} locale={locale} />
      )}
    </ExamShell>
  );
}
