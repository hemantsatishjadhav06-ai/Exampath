import type { Metadata } from "next";
import { AboutBlurbLong, AboutBlurbShort } from "@/components/AboutBlurb";
import { pageMeta } from "@/lib/seo";
import { siteConfig, type Locale } from "@/lib/site-config";

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  return pageMeta(params.locale, "/about", `About ${siteConfig.name}`, siteConfig.tagline);
}

export default function AboutPage({ params }: { params: { locale: Locale } }) {
  return (
    <div className="wrap max-w-3xl py-10">
      <h1 className="text-2xl font-extrabold tracking-tight">About {siteConfig.name}</h1>
      <AboutBlurbShort locale={params.locale} className="mt-4 text-slate-700" />
      <AboutBlurbLong locale={params.locale} className="mt-3 text-slate-600" />
      <p className="mt-3 text-sm text-slate-500">
        {params.locale === "hi"
          ? "हर अपडेट का सत्यापन आधिकारिक स्रोत से किया जाता है — असत्यापित सूचनाएँ स्पष्ट बैज के साथ दिखती हैं।"
          : "Every update is checked against the official source — anything not yet confirmed carries a clear ‘Unverified’ badge until it is."}
      </p>
    </div>
  );
}
