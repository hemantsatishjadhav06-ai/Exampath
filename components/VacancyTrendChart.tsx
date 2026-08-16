"use client";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { VacancyYear } from "@/lib/types";
import type { Locale } from "@/lib/site-config";

/** Year-on-year vacancy bars (ported from the sarkari-result build). */
export default function VacancyTrendChart({ history, locale }: { history: VacancyYear[]; locale: Locale }) {
  if (history.length < 2) return null;
  const data = [...history].sort((a, b) => a.year - b.year).map((h) => ({ year: String(h.year), seats: h.seats }));
  const latest = data[data.length - 1].year;
  return (
    <div className="card p-5">
      <h2 className="h2 mb-3">📊 {locale === "hi" ? "रिक्ति रुझान (वर्ष-वार)" : "Vacancy trend (year-wise)"}</h2>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="year" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
            <Tooltip formatter={(v) => [Number(v).toLocaleString("en-IN"), locale === "hi" ? "रिक्तियाँ" : "Vacancies"]} />
            <Bar dataKey="seats" radius={[6, 6, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.year} fill={d.year === latest ? "rgb(var(--brand-600))" : "rgb(var(--brand-200))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{locale === "hi" ? "स्रोत: आधिकारिक अधिसूचनाएँ" : "Source: official notifications"}</p>
    </div>
  );
}
