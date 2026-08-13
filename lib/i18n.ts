import { siteConfig, type Locale } from "@/lib/site-config";

export function isLocale(x: string): x is Locale {
  return (siteConfig.locales as readonly string[]).includes(x);
}

/** Prefix a path for a locale: en has no visible prefix, hi uses /hi. */
export function localePath(locale: Locale, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return locale === "en" ? p : `/hi${p === "/" ? "" : p}`;
}

/** Pick the localized variant of a bilingual pair, falling back to English. */
export function pick(locale: Locale, en?: string | null, hi?: string | null): string {
  return (locale === "hi" ? hi || en : en) ?? "";
}

/** UI chrome strings (content comes from Supabase, these are the shell only). */
const dict = {
  en: {
    home: "Home", search: "Search / Eligibility", calendar: "Calendar",
    bodies: "All Bodies", about: "About", contact: "Contact",
    activeExams: "Active Exams", upcomingExams: "Upcoming Exams",
    notices: "Notices", admitCity: "Admit Card / City Info", answerResult: "Answer Key / Result",
    popular: "Popular exams", central: "Central bodies", state: "State bodies",
    viewAll: "View all", apply: "Apply", daysLeft: "days left", closed: "Closed",
    verified: "Verified", unverified: "Unverified", follow: "Follow updates",
    vacancies: "Vacancies", age: "Age", qualification: "Qualification",
    overview: "Overview", applyTab: "Apply", syllabus: "Syllabus", pattern: "Exam Pattern",
    cutoff: "Cutoff", admitCard: "Admit Card / City Info", result: "Result / Answer Key",
    keyDates: "Key dates", timeline: "Timeline", noData: "Nothing here yet — check back soon.",
    searchCta: "Find exams you're eligible for",
    lastDate: "Last date", official: "Official website",
  },
  hi: {
    home: "होम", search: "खोज / पात्रता", calendar: "कैलेंडर",
    bodies: "सभी संस्थाएँ", about: "हमारे बारे में", contact: "संपर्क",
    activeExams: "सक्रिय परीक्षाएँ", upcomingExams: "आगामी परीक्षाएँ",
    notices: "सूचनाएँ", admitCity: "एडमिट कार्ड / सिटी सूचना", answerResult: "उत्तर कुंजी / परिणाम",
    popular: "लोकप्रिय परीक्षाएँ", central: "केंद्रीय संस्थाएँ", state: "राज्य संस्थाएँ",
    viewAll: "सभी देखें", apply: "आवेदन करें", daysLeft: "दिन शेष", closed: "बंद",
    verified: "सत्यापित", unverified: "असत्यापित", follow: "अपडेट पाएँ",
    vacancies: "रिक्तियाँ", age: "आयु", qualification: "योग्यता",
    overview: "विवरण", applyTab: "आवेदन", syllabus: "पाठ्यक्रम", pattern: "परीक्षा पैटर्न",
    cutoff: "कट-ऑफ़", admitCard: "एडमिट कार्ड / सिटी सूचना", result: "परिणाम / उत्तर कुंजी",
    keyDates: "मुख्य तिथियाँ", timeline: "समय-रेखा", noData: "अभी यहाँ कुछ नहीं है — जल्द देखें।",
    searchCta: "अपनी पात्रता की परीक्षाएँ खोजें",
    lastDate: "अंतिम तिथि", official: "आधिकारिक वेबसाइट",
  },
} as const;

export function t(locale: Locale) {
  return dict[locale];
}
