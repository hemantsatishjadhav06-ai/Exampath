import Link from "next/link";
import { localePath, t } from "@/lib/i18n";
import { siteConfig, type Locale } from "@/lib/site-config";
import { AboutBlurbLong } from "@/components/AboutBlurb";

export default function Footer({ locale }: { locale: Locale }) {
  const s = t(locale);
  const cols: [string, [string, string][]][] = [
    ["Explore", [[localePath(locale, "/search"), s.search], [localePath(locale, "/calendar"), s.calendar], [localePath(locale, "/bodies"), s.bodies]]],
    ["Categories", [
      [localePath(locale, "/category/qualification/graduate"), "Graduate"],
      [localePath(locale, "/category/qualification/12th"), "12th pass"],
      [localePath(locale, "/category/type/banking"), "Banking"],
      [localePath(locale, "/category/type/railway"), "Railway"],
    ]],
    ["Company", [
      [localePath(locale, "/about"), s.about], [localePath(locale, "/contact"), s.contact],
      [localePath(locale, "/privacy-policy"), "Privacy"], [localePath(locale, "/terms"), "Terms"],
      [localePath(locale, "/disclaimer"), "Disclaimer"],
    ]],
  ];
  return (
    <footer className="mt-14 border-t border-slate-200 bg-white">
      <div className="wrap grid gap-8 py-10 md:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="flex items-center gap-2 font-extrabold text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">म</span>
            <span><span className="text-brand-700">Mera</span><span className="text-accent-600">Safar</span></span>
          </div>
          <AboutBlurbLong locale={locale} className="mt-3 max-w-sm text-sm text-slate-500" />
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {cols.map(([h, links]) => (
            <div key={h}>
              <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">{h}</h4>
              {links.map(([href, label]) => (
                <Link key={href} href={href} className="block py-1 text-sm text-slate-600 hover:text-brand-700">{label}</Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="wrap py-4 text-xs text-slate-400">
          © {new Date().getFullYear()} {siteConfig.name} · A {siteConfig.parentCompany} company · Not a government website — always verify on the official site. · {siteConfig.supportEmail}
        </div>
      </div>
    </footer>
  );
}
