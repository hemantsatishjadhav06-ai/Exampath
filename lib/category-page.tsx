import ExamCard from "@/components/ExamCard";
import { t } from "@/lib/i18n";
import { getBodies, getCycles } from "@/lib/queries";
import type { Locale } from "@/lib/site-config";

export async function CategoryList({ locale, filter, h1, intro }: {
  locale: Locale;
  filter: Parameters<typeof getCycles>[0];
  h1: string; intro: string;
}) {
  const s = t(locale);
  const [bodies, cycles] = await Promise.all([getBodies(), getCycles(filter)]);
  const bodyMap = new Map(bodies.map((b) => [b.slug, b]));
  return (
    <div className="wrap py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">{h1}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">{intro}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cycles.length === 0 && <p className="card col-span-full p-10 text-center text-slate-400">{s.noData}</p>}
        {cycles.map((c) => <ExamCard key={c.id} cycle={c} body={bodyMap.get(c.body_slug)} locale={locale} />)}
      </div>
    </div>
  );
}
