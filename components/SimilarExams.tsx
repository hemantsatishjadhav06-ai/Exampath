import ExamCard from "@/components/ExamCard";
import type { Locale } from "@/lib/site-config";
import type { Body, Cycle } from "@/lib/types";

/** "Students also track" grid (ported from the sarkari-result build). */
export default function SimilarExams({ cycles, bodies, locale }: {
  cycles: Cycle[]; bodies: Map<string, Body>; locale: Locale;
}) {
  if (cycles.length === 0) return null;
  return (
    <section>
      <h2 className="h2 mb-3">🎯 {locale === "hi" ? "छात्र ये परीक्षाएँ भी देखते हैं" : "Students also track"}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cycles.slice(0, 3).map((c) => (
          <ExamCard key={c.id} cycle={c} body={bodies.get(c.body_slug)} locale={locale} />
        ))}
      </div>
    </section>
  );
}
