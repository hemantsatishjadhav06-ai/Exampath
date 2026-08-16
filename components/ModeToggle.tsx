"use client";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/site-config";

/** MeraSafar ⇄ Sarkari experience switch. The choice is applied as a
 *  data-mode attribute on <html> (an inline head script applies it before
 *  first paint, so there is no flash) and persisted in localStorage. */
export default function ModeToggle({ locale }: { locale: Locale }) {
  const hi = locale === "hi";
  const [sarkari, setSarkari] = useState<boolean | null>(null);

  useEffect(() => {
    setSarkari(document.documentElement.getAttribute("data-mode") === "sarkari");
  }, []);

  function toggle() {
    const next = !(sarkari ?? false);
    setSarkari(next);
    if (next) document.documentElement.setAttribute("data-mode", "sarkari");
    else document.documentElement.removeAttribute("data-mode");
    try { localStorage.setItem("site_mode", next ? "sarkari" : "mera"); } catch {}
  }

  return (
    <button onClick={toggle} title={hi ? "साइट का रूप बदलें" : "Switch site experience"}
      aria-pressed={sarkari ?? false}
      className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-[11px] font-extrabold">
      <span className={`rounded-full px-2 py-1 ${sarkari ? "text-slate-400" : "bg-brand-600 text-white"}`}>Mera</span>
      <span className={`rounded-full px-2 py-1 ${sarkari ? "bg-brand-600 text-white" : "text-slate-400"}`}>Sarkari</span>
    </button>
  );
}
