import Link from "next/link";
import { localePath, t } from "@/lib/i18n";
import { siteConfig, type Locale } from "@/lib/site-config";
import LangSwitch from "@/components/LangSwitch";

export default function Header({ locale }: { locale: Locale }) {
  const s = t(locale);
  const nav = [
    [localePath(locale, "/"), s.home],
    [localePath(locale, "/search"), s.search],
    [localePath(locale, "/calendar"), s.calendar],
    [localePath(locale, "/bodies"), s.bodies],
  ] as const;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="wrap flex h-16 items-center gap-4">
        <Link href={localePath(locale, "/")} className="flex items-center gap-2.5 font-extrabold text-lg tracking-tight" aria-label={siteConfig.name}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-card">म</span>
          <span><span className="text-brand-700">Mera</span><span className="text-accent-600">Safar</span></span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LangSwitch locale={locale} />
        </div>
      </div>
    </header>
  );
}
