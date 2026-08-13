import Link from "next/link";
import { localePath, t } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";

const TABS = [
  ["", "overview"], ["/apply", "applyTab"], ["/syllabus", "syllabus"],
  ["/exam-pattern", "pattern"], ["/cutoff", "cutoff"],
  ["/admit-card", "admitCard"], ["/result", "result"],
] as const;

export default function ExamTabBar({ cycleId, active, locale }: { cycleId: string; active: string; locale: Locale }) {
  const s = t(locale) as Record<string, string>;
  return (
    <nav aria-label="Exam sections" className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
      {TABS.map(([seg, key]) => (
        <Link key={key} href={localePath(locale, `/exam/${cycleId}${seg}`)}
          className={`flex-none whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-bold transition ${
            active === key ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"}`}>
          {s[key]}
        </Link>
      ))}
    </nav>
  );
}
