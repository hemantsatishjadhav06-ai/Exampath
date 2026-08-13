import Link from "next/link";
import { daysLeft, fmtDate } from "@/lib/format";
import { localePath, pick, t } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { Cycle, KeyDate } from "@/lib/types";

const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Month-selector strip + that month's dated list (NOT a full date grid). */
export default function MonthCalendar({ year, month1, items, locale, basePath }: {
  year: number; month1: number; items: (KeyDate & { cycle?: Cycle })[];
  locale: Locale; basePath: string;
}) {
  const s = t(locale);
  return (
    <div>
      <div className="scrollbar-none -mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
        {M.map((m, i) => {
          const on = i + 1 === month1;
          return (
            <Link key={m} href={`${localePath(locale, basePath)}?y=${year}&m=${i + 1}`}
              className={`flex-none rounded-full border px-4 py-1.5 text-[13px] font-bold ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-200"}`}>
              {m} {String(year).slice(2)}
            </Link>
          );
        })}
      </div>
      <div className="card divide-y divide-slate-100 px-4">
        {items.length === 0 && <p className="py-6 text-center text-sm text-slate-400">{s.noData}</p>}
        {items.map((k) => {
          const dl = daysLeft(k.date);
          const hot = k.is_deadline && dl != null && dl >= 0 && dl <= 7;
          return (
            <Link key={k.id} href={localePath(locale, `/exam/${k.cycle_id}`)} className="flex items-center gap-3 py-3 hover:bg-slate-50">
              <span className={`grid h-11 w-11 flex-none place-items-center rounded-lg text-xs font-extrabold ${hot ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700"}`}>
                {k.date.slice(8, 10)}
              </span>
              <div className="min-w-0">
                <b className="block truncate text-sm font-bold">{pick(locale, k.cycle?.title, k.cycle?.title_hi) || k.cycle_id} — {pick(locale, k.label, k.label_hi)}</b>
                <span className="text-xs text-slate-500">{fmtDate(k.date, locale)}</span>
              </div>
              <span className={`ml-auto flex-none text-xs font-extrabold ${hot ? "text-red-600" : "text-brand-700"}`}>
                {dl == null ? "" : dl < 0 ? "Done" : dl === 0 ? "Today" : `${dl}d`}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
