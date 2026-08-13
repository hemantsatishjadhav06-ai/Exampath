import { t } from "@/lib/i18n";
import { localePath } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";
import type { Body, CategoryRow } from "@/lib/types";

/** All fields optional; submits as GET query params to /search (SEO-indexable). */
export default function SearchFilterForm({ locale, bodies = [], categories = [], defaults = {}, bodyLocked }: {
  locale: Locale; bodies?: Body[]; categories?: CategoryRow[];
  defaults?: Partial<Record<"qualification" | "age" | "body" | "category", string>>;
  bodyLocked?: string;
}) {
  const s = t(locale);
  return (
    <form action={localePath(locale, "/search")} method="get"
      className="card flex flex-wrap items-end gap-3 p-4" aria-label={s.searchCta}>
      <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-bold text-slate-600">
        🎓 {s.qualification}
        <select name="qualification" defaultValue={defaults.qualification ?? ""} className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium">
          <option value="">{locale === "hi" ? "कोई भी" : "Any"}</option>
          <option value="10th">10th pass</option><option value="12th">12th pass</option>
          <option value="graduate">Graduate</option><option value="pg">Post-graduate</option>
        </select>
      </label>
      <label className="flex min-w-[110px] flex-col gap-1 text-xs font-bold text-slate-600">
        🎂 {s.age}
        <input type="number" name="age" min={14} max={60} defaultValue={defaults.age ?? ""} placeholder="21"
          className="h-11 w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium" />
      </label>
      {bodyLocked ? <input type="hidden" name="body" value={bodyLocked} /> : (
        <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-bold text-slate-600">
          🏛 {locale === "hi" ? "संस्था" : "Conducted by"}
          <select name="body" defaultValue={defaults.body ?? ""} className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium">
            <option value="">{locale === "hi" ? "कोई भी" : "Any"}</option>
            {bodies.map((b) => <option key={b.slug} value={b.slug}>{b.short_name}</option>)}
          </select>
        </label>
      )}
      {categories.length > 0 && (
        <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-bold text-slate-600">
          🗂 {locale === "hi" ? "श्रेणी" : "Category"}
          <select name="category" defaultValue={defaults.category ?? ""} className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium">
            <option value="">{locale === "hi" ? "कोई भी" : "Any"}</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
      )}
      <button className="btn-accent" type="submit">{s.searchCta}</button>
    </form>
  );
}
