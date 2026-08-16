import { pick } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { Faq } from "@/lib/types";

/** Native <details> FAQ accordion (ported from the sarkari-result build). */
export default function FaqAccordion({ faqs, locale }: { faqs: Faq[]; locale: Locale }) {
  if (faqs.length === 0) return null;
  return (
    <section className="card p-5">
      <h2 className="h2 mb-3">❓ {locale === "hi" ? "अक्सर पूछे जाने वाले प्रश्न" : "Frequently asked questions"}</h2>
      <div className="divide-y divide-slate-100">
        {faqs.map((f, i) => (
          <details key={i} className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold">
              {pick(locale, f.q, f.q_hi)}
              <span className="text-slate-400 transition group-open:rotate-45">＋</span>
            </summary>
            <p className="mt-2 text-sm text-slate-600">{pick(locale, f.a, f.a_hi)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
