import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { siteConfig, type Locale } from "@/lib/site-config";

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  return pageMeta(params.locale, "/terms", "Terms of Use", `${siteConfig.name} terms of use.`);
}

export default function TermsPage() {
  return (
    <div className="wrap max-w-3xl py-10 text-sm text-slate-600">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Terms of Use</h1>
      <p className="mt-4">By using {siteConfig.name} you accept that the content is informational only, provided as-is without warranty. You may link to our pages freely. Automated scraping that burdens the service, or republishing our compiled data wholesale without attribution, is not permitted.</p>
    </div>
  );
}
