import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { isLocale } from "@/lib/i18n";
import { siteConfig, baseUrl, type Locale } from "@/lib/site-config";

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = (isLocale(params.locale) ? params.locale : "en") as Locale;
  return {
    metadataBase: new URL(baseUrl),
    title: { default: `${siteConfig.name} — ${locale === "hi" ? "सरकारी परीक्षा पोर्टल" : "Government Exam Portal"}`, template: `%s | ${siteConfig.name}` },
    description: locale === "hi" ? siteConfig.taglineHi : siteConfig.tagline,
  };
}

export default function LocaleLayout({ children, params }: { children: ReactNode; params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  return (
    <html lang={locale === "hi" ? "hi-IN" : "en-IN"}>
      <body>
        <Header locale={locale} />
        <main id="main" className="min-h-[60vh]">{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
