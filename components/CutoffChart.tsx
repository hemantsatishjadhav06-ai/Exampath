"use client";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Cutoff } from "@/lib/types";
import type { Locale } from "@/lib/site-config";

/** Category-wise cutoff bars (ported from the sarkari-result build).
 *  With multiple phases, the first occurrence per category wins. */
export default function CutoffChart({ cutoffs, locale }: { cutoffs: Cutoff[]; locale: Locale }) {
  const byCat = new Map<string, number>();
  for (const c of cutoffs) {
    if (c.marks != null && !byCat.has(c.category)) byCat.set(c.category, c.marks);
  }
  if (byCat.size < 2) return null;
  const data = Array.from(byCat, ([category, marks]) => ({ category, marks }));
  return (
    <div className="card p-5">
      <h2 className="h2 mb-3">📉 {locale === "hi" ? "कट-ऑफ़ तुलना (श्रेणी-वार)" : "Cutoff comparison (category-wise)"}</h2>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="category" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} domain={["dataMin - 10", "dataMax + 5"]} />
            <Tooltip formatter={(v) => [String(v), locale === "hi" ? "अंक" : "Marks"]} />
            <Bar dataKey="marks" fill="rgb(var(--accent-500))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
