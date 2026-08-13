import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { siteConfig, type Locale } from "@/lib/site-config";

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  return pageMeta(params.locale, "/privacy-policy", "Privacy Policy", `${siteConfig.name} privacy policy.`);
}

export default function PrivacyPage() {
  return (
    <div className="wrap prose max-w-3xl py-10 text-sm text-slate-600">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Privacy Policy</h1>
      <p className="mt-4">{siteConfig.name} collects the minimum data needed to run the service: anonymous page-view counts (no cookies required), and — only if you opt in to alerts — the contact number/handle you provide, used solely to send the exam updates you asked for. We never sell data. Sessions use secure, httpOnly cookies. To delete your account data, email {siteConfig.supportEmail}.</p>
    </div>
  );
}
