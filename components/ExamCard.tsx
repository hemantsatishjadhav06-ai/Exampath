import Link from "next/link";
import Emblem from "@/components/Emblem";
import StatusPill from "@/components/StatusPill";
import { daysLeft, fmtDate, inr } from "@/lib/format";
import { localePath, pick, t } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { Body, Cycle } from "@/lib/types";

export default function ExamCard({ cycle, body, locale }: { cycle: Cycle; body?: Body | null; locale: Locale }) {
  const s = t(locale);
  const dl = daysLeft(cycle.application_end);
  return (
    <div className="card flex flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center gap-3">
        <Emblem short={body?.short_name ?? cycle.body_slug.toUpperCase()} color={body?.color} size={42} />
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-extrabold">{pick(locale, cycle.title, cycle.title_hi)}</h3>
          <p className="truncate text-xs text-slate-500">{pick(locale, body?.name, body?.name_hi)}</p>
        </div>
        <div className="ml-auto"><StatusPill status={cycle.status} locale={locale} /></div>
      </div>
      <div className="flex gap-5 border-t border-dashed border-slate-200 pt-2 text-sm">
        <div><b className="block font-extrabold">{inr(cycle.vacancy)}</b><span className="text-[11px] text-slate-500">{s.vacancies}</span></div>
        <div><b className="block font-extrabold">{cycle.age_min ?? "—"}–{cycle.age_max ?? "—"}</b><span className="text-[11px] text-slate-500">{s.age}</span></div>
        <div>
          <b className={`block font-extrabold ${dl != null && dl <= 7 && dl >= 0 ? "text-red-600" : ""}`}>
            {dl == null ? "—" : dl < 0 ? s.closed : `${dl}d`}
          </b>
          <span className="text-[11px] text-slate-500">{dl != null && dl >= 0 ? s.lastDate + " " + fmtDate(cycle.application_end, locale) : s.lastDate}</span>
        </div>
      </div>
      <Link href={localePath(locale, `/exam/${cycle.id}`)} className="btn-primary h-10 text-[13px]">
        {locale === "hi" ? "पूरा विवरण देखें" : "View full details"}
      </Link>
    </div>
  );
}
