import { siteConfig, type Locale } from "@/lib/site-config";

export function AboutBlurbShort({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <p className={className}>
      {locale === "hi"
        ? `${siteConfig.name} — हर सरकारी परीक्षा की सूचना, तिथि, पात्रता और परिणाम, आधिकारिक स्रोतों से सत्यापित।`
        : `${siteConfig.name} tracks every Indian government exam — notifications, dates, eligibility and results, verified from official sources.`}
    </p>
  );
}

export function AboutBlurbLong({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <p className={className}>
      {locale === "hi"
        ? `${siteConfig.name} (${siteConfig.parentCompany} की एक कंपनी) छात्रों के लिए बना एक तेज़, स्वच्छ और द्विभाषी सरकारी-परीक्षा पोर्टल है — SSC, UPSC, बैंकिंग, रेलवे और राज्य PSC की हर अधिसूचना, एडमिट कार्ड और परिणाम एक जगह, बिना अव्यवस्था के।`
        : `${siteConfig.name} (a ${siteConfig.parentCompany} company) is a fast, clean, bilingual portal for Indian government exams — every SSC, UPSC, banking, railway and state-PSC notification, admit card and result in one place, without the clutter.`}
    </p>
  );
}
