import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { siteConfig, type Locale } from "@/lib/site-config";

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  return pageMeta(params.locale, "/contact", `Contact ${siteConfig.name}`, `Get in touch with the ${siteConfig.name} team.`);
}

export default function ContactPage({ params }: { params: { locale: Locale } }) {
  const hi = params.locale === "hi";
  return (
    <div className="wrap max-w-3xl py-10">
      <h1 className="text-2xl font-extrabold tracking-tight">{hi ? "संपर्क करें" : "Contact"}</h1>
      <p className="mt-4 text-slate-600">
        {hi ? "सुधार, सुझाव या नई परीक्षा जोड़ने के लिए लिखें:" : "Corrections, suggestions, or an exam we should add — write to us:"}
      </p>
      <p className="mt-2 font-bold text-brand-700">{siteConfig.supportEmail}</p>
    </div>
  );
}
