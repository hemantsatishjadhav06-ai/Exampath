"use client";
import { useState } from "react";
import AuthModal from "@/components/AuthModal";
import type { Locale } from "@/lib/site-config";

/** Header sign-in button — opens the two-path auth modal (OTP / password). */
export default function HeaderAuth({ locale }: { locale: Locale }) {
  const hi = locale === "hi";
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:border-brand-300 hover:text-brand-700">
        {done ? "✓ " + (hi ? "साइन-इन" : "Signed in") : hi ? "साइन-इन" : "Sign in"}
      </button>
      {open && <AuthModal locale={locale} onSuccess={() => { setDone(true); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
}
