import Link from "next/link";
import { daysLeft, fmtDate } from "@/lib/format";
import { localePath, pick } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { Cycle } from "@/lib/types";

/** Horizontal "closing soon" ticker (ported from the sarkari-result build):
 *  the applications nearest their last date, with a days-left chip. */
export default function ClosingSoonStrip({ cycles, locale }: { cycles: Cycle[]; locale: Locale }) {
  const hi = locale === "hi";
  const soon = cycles
    .filter((c) => {
      const d = daysLeft(c.application_end);
      return d !== null && d >= 0;
    })
    .sort((a, b) => (daysLeft(a.application_end) ?? 999) - (daysLeft(b.application_end) ?? 999))
    .slice(0, 8);
  if (soon.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-3 pb-1">
        {soon.map((c) => {
          const d = daysLeft(c.application_end) ?? 0;
          return (
            <Link key={c.id} href={localePath(locale, `/exam/${c.id}`)}
              className="card flex min-w-[230px] items-center gap-3 border-l-4 border-l-brand-600 p-3 hover:shadow-lift">
              <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl text-xs font-extrabold ${d <= 3 ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"}`}>
                {d}{hi ? " दिन" : "d"}
              </span>
              <span>
                <b className="block text-[13px] leading-tight">{pick(locale, c.title, c.title_hi)}</b>
                <span className="text-[11px] text-slate-500">{hi ? "अंतिम तिथि" : "Last date"}: {fmtDate(c.application_end, locale)}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
