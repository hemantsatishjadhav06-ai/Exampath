"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/site-config";

/** Links to the hreflang counterpart of the CURRENT page, not the homepage. */
export default function LangSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname() || "/";
  const bare = pathname.replace(/^\/hi(?=\/|$)/, "") || "/";
  const other = locale === "hi" ? bare : `/hi${bare === "/" ? "" : bare}`;
  return (
    <Link
      href={other}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700"
      aria-label={locale === "hi" ? "Switch to English" : "हिन्दी में देखें"}
    >
      {locale === "hi" ? "EN" : "हिं"}
    </Link>
  );
}
