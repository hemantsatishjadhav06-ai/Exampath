import { fmtDate } from "@/lib/format";
import { pick } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { Stage } from "@/lib/types";

export default function TimelineStepper({ stages, locale }: { stages: Stage[]; locale: Locale }) {
  if (!stages.length) return null;
  return (
    <ol className="flex gap-0 overflow-x-auto py-2">
      {stages.map((st, i) => {
        const now = !st.done && (i === 0 || stages[i - 1].done);
        return (
          <li key={st.id} className="relative min-w-[104px] flex-1 pt-6 text-center">
            {i > 0 && <span aria-hidden className={`absolute left-[calc(-50%+9px)] top-2 h-[3px] w-full ${stages[i - 1].done ? "bg-emerald-500" : "bg-slate-200"}`} />}
            <span aria-hidden className={`absolute left-1/2 top-0 z-10 h-4 w-4 -translate-x-1/2 rounded-full border-[3px] ${
              st.done ? "border-emerald-500 bg-emerald-500" : now ? "border-accent-500 bg-accent-500 ring-4 ring-accent-100" : "border-slate-300 bg-white"}`} />
            <b className="block text-xs font-bold">{pick(locale, st.name, st.name_hi)}</b>
            <span className="text-[11px] text-slate-500">{st.date ? fmtDate(st.date, locale) : "TBA"}{st.precision === "tentative" ? "*" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
