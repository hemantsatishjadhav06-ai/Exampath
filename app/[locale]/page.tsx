import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { AboutBlurbShort } from "@/components/AboutBlurb";
import BodyIconGrid from "@/components/BodyIconGrid";
import PopularGrid from "@/components/PopularGrid";
import SearchFilterForm from "@/components/SearchFilterForm";
import UpdatesFeed3Column from "@/components/UpdatesFeed3Column";
import { localePath, t } from "@/lib/i18n";
import { getBodies, getPopularCycles, getVisibleUpdates } from "@/lib/queries";
import { pageMeta, jsonLd } from "@/lib/seo";
import { siteConfig, baseUrl, type Locale } from "@/lib/site-config";

export const revalidate = 3600; // safety net — primary freshness is on-demand

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  const hi = params.locale === "hi";
  return pageMeta(params.locale, "/",
    hi ? `${siteConfig.name} — हर सरकारी परीक्षा, एक जगह` : `${siteConfig.name} — Every Government Exam, One Place`,
    hi ? siteConfig.taglineHi : siteConfig.tagline);
}

export default async function Home({ params }: { params: { locale: Locale } }) {
  const locale = params.locale;
  const s = t(locale);
  const [bodies, updates, popular] = await Promise.all([
    getBodies(), getVisibleUpdates(45), getPopularCycles(9),
  ]);
  const bodyMap = new Map(bodies.map((b) => [b.slug, b]));
  const central = bodies.filter((b) => b.level === "central").slice(0, 8);
  const state = bodies.filter((b) => b.level === "state").slice(0, 8);

  const org = {
    "@context": "https://schema.org", "@type": "Organization",
    name: siteConfig.name, url: baseUrl, parentOrganization: siteConfig.parentCompany,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(org) }} />
      {/* Hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="wrap py-10 text-center sm:py-14">
          <p className="mx-auto mb-3 inline-flex rounded-full border border-brand-100 bg-brand-50 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-brand-700">
            🇮🇳 {locale === "hi" ? "सरकारी परीक्षाओं का भरोसेमंद साथी" : "India's clean, verified exam tracker"}
          </p>
          <h1 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-[42px] sm:leading-tight">
            {locale === "hi" ? <>सरकारी नौकरी तक <span className="text-brand-600">आपका सफ़र</span></> : <>Your <span className="text-brand-600">safar</span> to a government job</>}
          </h1>
          <AboutBlurbShort locale={locale} className="mx-auto mt-3 max-w-xl text-slate-500" />
          <div className="mx-auto mt-6 max-w-3xl text-left">
            <SearchFilterForm locale={locale} bodies={bodies} />
          </div>
        </div>
      </section>

      <AdSlot slot="header-banner" />

      <div className="wrap flex flex-col gap-12 py-10">
        {/* Latest updates — 3 buckets */}
        <section aria-labelledby="updates-h">
          <div className="section-title">
            <h2 id="updates-h" className="h2">🆕 {locale === "hi" ? "ताज़ा अपडेट" : "Latest updates"}</h2>
          </div>
          <UpdatesFeed3Column updates={updates} locale={locale} />
        </section>

        {/* Popular exams */}
        {popular.length > 0 && (
          <section aria-labelledby="popular-h">
            <div className="section-title"><h2 id="popular-h" className="h2">⭐ {s.popular}</h2></div>
            <PopularGrid cycles={popular} bodies={bodyMap} locale={locale} />
          </section>
        )}

        {/* Bodies */}
        <BodyIconGrid bodies={central} locale={locale} title={`🏛 ${s.central}`} viewAllHref={localePath(locale, "/bodies")} />
        <BodyIconGrid bodies={state} locale={locale} title={`🗺 ${s.state}`} viewAllHref={localePath(locale, "/bodies")} />

        {(!bodies.length && !updates.length) && (
          <p className="card p-10 text-center text-slate-400">{s.noData}</p>
        )}
      </div>
    </>
  );
}
