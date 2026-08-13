import type { Metadata } from "next";
import { baseUrl, siteConfig, type Locale } from "@/lib/site-config";
import { localePath } from "@/lib/i18n";

/** Metadata with canonical + hreflang pair (en/hi + x-default). */
export function pageMeta(locale: Locale, path: string, title: string, description: string): Metadata {
  const canonical = `${baseUrl}${localePath(locale, path)}`;
  return {
    title, description,
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}${localePath("en", path)}`,
        hi: `${baseUrl}${localePath("hi", path)}`,
        "x-default": `${baseUrl}${localePath("en", path)}`,
      },
    },
    openGraph: { title, description, url: canonical, siteName: siteConfig.name, type: "website", locale: locale === "hi" ? "hi_IN" : "en_IN" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export function breadcrumbLd(items: { name: string; path: string }[], locale: Locale) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem", position: i + 1, name: it.name,
      item: `${baseUrl}${localePath(locale, it.path)}`,
    })),
  };
}
