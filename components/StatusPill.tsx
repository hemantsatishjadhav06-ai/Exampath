const STYLES: Record<string, string> = {
  application_open: "bg-brand-50 text-brand-700",
  closing_soon: "bg-red-50 text-red-600",
  upcoming: "bg-violet-50 text-violet-700",
  admit_card: "bg-amber-50 text-amber-700",
  exam_scheduled: "bg-sky-50 text-sky-700",
  result_awaited: "bg-amber-50 text-amber-700",
  result_out: "bg-emerald-50 text-emerald-700",
  completed: "bg-slate-100 text-slate-500",
};
const LABELS: Record<string, [string, string]> = {
  application_open: ["Applications Open", "आवेदन जारी"],
  closing_soon: ["Closing Soon", "जल्द बंद"],
  upcoming: ["Upcoming", "आगामी"],
  admit_card: ["Admit Card Out", "एडमिट कार्ड जारी"],
  exam_scheduled: ["Exam Scheduled", "परीक्षा निर्धारित"],
  result_awaited: ["Result Awaited", "परिणाम प्रतीक्षित"],
  result_out: ["Result Out", "परिणाम जारी"],
  completed: ["Completed", "संपन्न"],
};
export default function StatusPill({ status, locale = "en" }: { status: string; locale?: "en" | "hi" }) {
  const cls = STYLES[status] ?? STYLES.upcoming;
  const label = (LABELS[status] ?? LABELS.upcoming)[locale === "hi" ? 1 : 0];
  return <span className={`pill ${cls}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}
