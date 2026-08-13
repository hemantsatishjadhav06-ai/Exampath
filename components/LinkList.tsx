import { pick, t } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { CycleLink } from "@/lib/types";

export default function LinkList({ links, locale }: { links: CycleLink[]; locale: Locale }) {
  const s = t(locale);
  if (!links.length) return <p className="text-sm text-slate-400">{s.noData}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {links.map((l) => (
        <li key={l.id}>
          <a href={l.url} target="_blank" rel="noopener" className="flex items-center gap-3 py-3 hover:bg-slate-50">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-emerald-50 text-emerald-600">↗</span>
            <div className="min-w-0">
              <b className="block truncate text-sm font-bold">{pick(locale, l.label, l.label_hi)}</b>
              <span className="text-xs text-slate-500">{l.kind}{l.verified ? " · ✓ verified" : ""}</span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
