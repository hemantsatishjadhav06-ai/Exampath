import Link from "next/link";
import VerifyBadge from "@/components/VerifyBadge";
import { timeAgo } from "@/lib/format";
import { localePath, pick, t } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { Cycle, Update } from "@/lib/types";
import AdSlot from "@/components/AdSlot";

type Item = Update & { cycle?: Cycle };
const TAB_PATH: Record<string, string> = {
  overview: "", apply: "/apply", syllabus: "/syllabus", pattern: "/exam-pattern",
  cutoff: "/cutoff", admit_card: "/admit-card", result: "/result",
};
const bucketOf = (k: string) =>
  k === "city_intimation" || k === "admit_card" ? "admit"
  : k === "answer_key" || k === "result" ? "result" : "notice";

function Row({ u, locale }: { u: Item; locale: Locale }) {
  const href = localePath(locale, `/exam/${u.cycle_id}${TAB_PATH[u.tab_link] ?? ""}`);
  return (
    <Link href={href} className="card flex items-start gap-3 p-3.5 hover:border-brand-200">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold leading-snug">{pick(locale, u.text, u.text_hi)}</p>
        <p className="mt-1 text-xs text-slate-500">{pick(locale, u.cycle?.title, u.cycle?.title_hi) || u.cycle_id} · {timeAgo(u.published_at, locale)}</p>
      </div>
      <VerifyBadge status={u.status} locale={locale} />
    </Link>
  );
}

export default function UpdatesFeed3Column({ updates, locale }: { updates: Item[]; locale: Locale }) {
  const s = t(locale);
  const buckets: [string, Item[]][] = [
    [s.notices, updates.filter((u) => bucketOf(u.kind) === "notice")],
    [s.admitCity, updates.filter((u) => bucketOf(u.kind) === "admit")],
    [s.answerResult, updates.filter((u) => bucketOf(u.kind) === "result")],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {buckets.map(([title, items], bi) => (
        <section key={title} aria-label={title}>
          <h3 className="mb-2.5 text-sm font-extrabold uppercase tracking-wide text-slate-500">{title}</h3>
          <div className="flex flex-col gap-2.5">
            {items.length === 0 && <p className="card p-4 text-sm text-slate-400">{t(locale).noData}</p>}
            {items.slice(0, 10).map((u, i) => (
              <div key={u.id} className="contents">
                <Row u={u} locale={locale} />
                {bi === 0 && i === 7 && <AdSlot slot="home-infeed" />}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
