import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { siteConfig, type Locale } from "@/lib/site-config";

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  return pageMeta(params.locale, "/disclaimer", "Disclaimer", `${siteConfig.name} disclaimer.`);
}

export default function DisclaimerPage() {
  return (
    <div className="wrap max-w-3xl py-10 text-sm text-slate-600">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Disclaimer</h1>
      <p className="mt-4">{siteConfig.name} is an independent information service and is <b>not affiliated with any government body</b>. Exam information is compiled from official sources and clearly marked when unverified. Dates and details can change — always confirm on the conducting body's official website (linked on every exam page) before acting.</p>
    </div>
  );
}
