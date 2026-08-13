import Link from "next/link";
import Emblem from "@/components/Emblem";
import { localePath, pick, t } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { Body } from "@/lib/types";

export default function BodyIconGrid({ bodies, locale, title, viewAllHref }: {
  bodies: Body[]; locale: Locale; title: string; viewAllHref?: string;
}) {
  const s = t(locale);
  if (!bodies.length) return null;
  return (
    <section>
      <div className="section-title">
        <h2 className="h2">{title}</h2>
        {viewAllHref && <Link href={viewAllHref} className="text-sm font-bold text-brand-700">{s.viewAll} →</Link>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {bodies.map((b) => (
          <Link key={b.slug} href={localePath(locale, `/body/${b.slug}`)} className="card flex flex-col items-center gap-2 p-4 text-center hover:border-brand-200">
            <Emblem short={b.short_name} color={b.color} size={48} />
            <b className="text-sm font-extrabold">{b.short_name}</b>
            <span className="line-clamp-2 text-xs text-slate-500">{pick(locale, b.name, b.name_hi)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
