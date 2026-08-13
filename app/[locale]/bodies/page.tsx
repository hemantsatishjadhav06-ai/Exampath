import type { Metadata } from "next";
import Link from "next/link";
import Emblem from "@/components/Emblem";
import { localePath, pick, t } from "@/lib/i18n";
import { getBodies, getCycles } from "@/lib/queries";
import { pageMeta } from "@/lib/seo";
import type { Locale } from "@/lib/site-config";

export const revalidate = 3600;

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  const hi = params.locale === "hi";
  return pageMeta(params.locale, "/bodies",
    hi ? "सभी परीक्षा संस्थाएँ" : "All Conducting Bodies — Central & State",
    hi ? "SSC, UPSC, बैंकिंग, रेलवे व राज्य PSC — सभी संस्थाएँ सक्रिय/आगामी गणना के साथ।" : "Every exam conducting body — SSC, UPSC, banking, railway and state PSCs — with live active/upcoming exam counts.");
}

export default async function BodiesPage({ params }: { params: { locale: Locale } }) {
  const locale = params.locale;
  const s = t(locale);
  const [bodies, cycles] = await Promise.all([getBodies(), getCycles()]);
  const counts = new Map<string, { active: number; upcoming: number }>();
  for (const c of cycles) {
    const e = counts.get(c.body_slug) ?? { active: 0, upcoming: 0 };
    if (c.application_state === "active") e.active++;
    if (c.application_state === "upcoming") e.upcoming++;
    counts.set(c.body_slug, e);
  }
  const groups: [string, typeof bodies][] = [
    [`🏛 ${s.central}`, bodies.filter((b) => b.level === "central")],
    [`🗺 ${s.state}`, bodies.filter((b) => b.level === "state")],
  ];
  return (
    <div className="wrap flex flex-col gap-10 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">{s.bodies}</h1>
      {bodies.length === 0 && <p className="card p-10 text-center text-slate-400">{s.noData}</p>}
      {groups.map(([title, list]) => list.length > 0 && (
        <section key={title}>
          <h2 className="h2 mb-4">{title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((b) => {
              const c = counts.get(b.slug) ?? { active: 0, upcoming: 0 };
              return (
                <Link key={b.slug} href={localePath(locale, `/body/${b.slug}`)} className="card flex items-center gap-3 p-4 hover:border-brand-200">
                  <Emblem short={b.short_name} color={b.color} size={46} />
                  <div className="min-w-0">
                    <b className="block truncate font-extrabold">{pick(locale, b.name, b.name_hi)}</b>
                    <span className="text-xs text-slate-500">
                      {c.active} {s.activeExams.toLowerCase()} · {c.upcoming} {s.upcomingExams.toLowerCase()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
