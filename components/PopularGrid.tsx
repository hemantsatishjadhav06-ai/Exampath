import ExamCard from "@/components/ExamCard";
import type { Locale } from "@/lib/site-config";
import type { Body, Cycle } from "@/lib/types";

export default function PopularGrid({ cycles, bodies, locale }: { cycles: Cycle[]; bodies: Map<string, Body>; locale: Locale }) {
  if (!cycles.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cycles.map((c) => <ExamCard key={c.id} cycle={c} body={bodies.get(c.body_slug)} locale={locale} />)}
    </div>
  );
}
