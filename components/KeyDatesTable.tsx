import { daysLeft, fmtDate } from "@/lib/format";
import { pick, t } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { KeyDate } from "@/lib/types";

export default function KeyDatesTable({ keyDates, locale }: { keyDates: KeyDate[]; locale: Locale }) {
  const s = t(locale);
  if (!keyDates.length) return <p className="text-sm text-slate-400">{s.noData}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {keyDates.map((k) => {
        const dl = daysLeft(k.date);
        const hot = k.is_deadline && dl != null && dl >= 0 && dl <= 7;
        return (
          <li key={k.id} className="flex items-center gap-3 py-2.5">
            <span className={`grid h-11 w-11 flex-none place-items-center rounded-lg text-center text-xs font-extrabold ${hot ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700"}`}>
              {fmtDate(k.date, locale).split(" ")[0]}<br />{fmtDate(k.date, locale).split(" ")[1]}
            </span>
            <div className="min-w-0">
              <b className="block text-sm font-bold">{pick(locale, k.label, k.label_hi)}</b>
              <span className="text-xs text-slate-500">{fmtDate(k.date, locale)}{k.precision === "tentative" ? " (tentative)" : ""}</span>
            </div>
            <span className={`ml-auto text-xs font-extrabold ${hot ? "text-red-600" : dl != null && dl < 0 ? "text-slate-400" : "text-brand-700"}`}>
              {dl == null ? "" : dl < 0 ? "Done" : dl === 0 ? "Today" : `${dl} ${s.daysLeft}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
