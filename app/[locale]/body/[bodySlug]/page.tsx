import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Emblem from "@/components/Emblem";
import ExamCard from "@/components/ExamCard";
import SearchFilterForm from "@/components/SearchFilterForm";
import TrackView from "@/components/TrackView";
import { pick, t } from "@/lib/i18n";
import { getBody, getCycles } from "@/lib/queries";
import { breadcrumbLd, jsonLd, pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { locale: Locale; bodySlug: string } }): Promise<Metadata> {
  const b = await getBody(params.bodySlug);
  const name = b ? pick(params.locale, b.name, b.name_hi) : params.bodySlug;
  return pageMeta(params.locale, `/body/${params.bodySlug}`,
    `${b?.short_name ?? name} — ${params.locale === "hi" ? "परीक्षाएँ व तिथियाँ" : "Exams, Dates & Updates"}`,
    b?.description ?? `${name} exams tracked with live dates and updates.`);
}

export default async function BodyPage({ params }: { params: { locale: Locale; bodySlug: string } }) {
  const locale = params.locale;
  const s = t(locale);
  const body = await getBody(params.bodySlug);
  if (!body) notFound();
  const cycles = await getCycles({ body: body.slug });
  const active = cycles.filter((c) => c.application_state === "active");
  const upcoming = cycles.filter((c) => c.application_state !== "active");

  const crumbs = breadcrumbLd([
    { name: "Home", path: "/" }, { name: "Bodies", path: "/bodies" },
    { name: body.short_name, path: `/body/${body.slug}` },
  ], locale);

  return (
    <div className="wrap py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />
      <TrackView entityType="body" entityId={body.slug} />
      <div className="card mb-6 flex flex-wrap items-center gap-4 p-5">
        <Emblem short={body.short_name} color={body.color} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{pick(locale, body.name, body.name_hi)}</h1>
          {body.description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{pick(locale, body.description, body.description_hi)}</p>}
        </div>
        {body.official_url && (
          <a href={body.official_url} target="_blank" rel="noopener" className="btn-ghost">{t(locale).official} ↗</a>
        )}
      </div>

      <SearchFilterForm locale={locale} bodyLocked={body.slug} />

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        {[[s.activeExams, active] as const, [s.upcomingExams, upcoming] as const].map(([title, list]) => (
          <section key={title}>
            <h2 className="h2 mb-4">{title} ({list.length})</h2>
            <div className="flex flex-col gap-4">
              {list.length === 0 && <p className="card p-4 text-sm text-slate-400">{s.noData}</p>}
              {list.map((c) => <ExamCard key={c.id} cycle={c} body={body} locale={locale} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
