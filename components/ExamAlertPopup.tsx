"use client";
import { useEffect, useState } from "react";
import FollowButton from "@/components/FollowButton";
import type { Locale } from "@/lib/site-config";

/** Gentle sign-up nudge shown once per session on exam pages (never on home). */
export default function ExamAlertPopup({ cycleId, title, locale }: { cycleId: string; title: string; locale: Locale }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ms:alert-shown")) return;
      const id = setTimeout(() => { setShow(true); sessionStorage.setItem("ms:alert-shown", "1"); }, 12000);
      return () => clearTimeout(id);
    } catch { /* no-op */ }
  }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(94vw,420px)] -translate-x-1/2">
      <div className="card flex items-center gap-3 p-4 shadow-lift">
        <div className="min-w-0 flex-1">
          <b className="block text-sm font-extrabold">{locale === "hi" ? "कोई तारीख़ न छूटे" : "Never miss a date"}</b>
          <span className="text-xs text-slate-500">{title}</span>
        </div>
        <FollowButton cycleId={cycleId} locale={locale} />
        <button onClick={() => setShow(false)} aria-label="Dismiss" className="text-xl text-slate-400">×</button>
      </div>
    </div>
  );
}
