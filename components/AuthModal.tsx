"use client";
import { useState } from "react";
import type { Locale } from "@/lib/site-config";

const METHODS = [
  ["whatsapp", "WhatsApp"], ["sms", "SMS"], ["telegram", "Telegram"],
] as const;

export default function AuthModal({ locale, onSuccess, onClose }: {
  locale: Locale; onSuccess: () => void; onClose: () => void;
}) {
  const hi = locale === "hi";
  // Two separate sign-in paths: OTP (MeraSafar's own) and email+password
  // (verified by the ExamPath backend — one account across both sites).
  const [tab, setTab] = useState<"otp" | "password">("otp");
  const [method, setMethod] = useState<string>("whatsapp");
  const [contact, setContact] = useState("");
  const [stage, setStage] = useState<"contact" | "otp">("contact");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwMode, setPwMode] = useState<"login" | "register">("login");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function passwordAuth() {
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: pwMode, email, password }),
    });
    setBusy(false);
    if (res.ok) onSuccess();
    else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || (hi ? "साइन-इन नहीं हो सका।" : "Could not sign you in."));
    }
  }

  async function sendOtp() {
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/send-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_type: method, contact_value: contact }),
    });
    setBusy(false);
    if (res.ok) setStage("otp");
    else setErr(hi ? "OTP भेजने में समस्या हुई।" : "Could not send the OTP — try again.");
  }
  async function verifyOtp() {
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_type: method, contact_value: contact, code }),
    });
    setBusy(false);
    if (res.ok) onSuccess();
    else setErr(hi ? "कोड ग़लत या समाप्त हो गया।" : "Wrong or expired code.");
  }

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{hi ? "अपडेट पाने के लिए साइन-इन" : "Sign in for alerts"}</h3>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-slate-400">×</button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-extrabold">
          <button onClick={() => { setTab("otp"); setErr(""); }}
            className={`rounded-lg py-2 ${tab === "otp" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}>
            {hi ? "OTP से" : "OTP"}
          </button>
          <button onClick={() => { setTab("password"); setErr(""); }}
            className={`rounded-lg py-2 ${tab === "password" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}>
            {hi ? "ईमेल-पासवर्ड" : "Email + password"}
          </button>
        </div>
        {tab === "password" ? (
          <>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              placeholder={hi ? "ईमेल" : "Email"} autoComplete="email"
              className="mb-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
              placeholder={hi ? "पासवर्ड (कम से कम 8 अक्षर)" : "Password (8+ characters)"}
              autoComplete={pwMode === "register" ? "new-password" : "current-password"}
              className="mb-3 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm" />
            <button onClick={passwordAuth} disabled={busy || !email || password.length < 8} className="btn-primary w-full disabled:opacity-50">
              {pwMode === "register" ? (hi ? "खाता बनाएँ" : "Create account") : (hi ? "साइन-इन करें" : "Sign in")}
            </button>
            <button onClick={() => setPwMode(pwMode === "login" ? "register" : "login")}
              className="mt-2 w-full text-center text-xs font-bold text-brand-700">
              {pwMode === "login" ? (hi ? "नया खाता? रजिस्टर करें" : "New here? Register") : (hi ? "खाता है? साइन-इन" : "Have an account? Sign in")}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {hi ? "यही खाता ExamPath पर भी चलता है।" : "The same account also works on ExamPath."}
            </p>
          </>
        ) : stage === "contact" ? (
          <>
            <div className="mb-3 flex gap-2">
              {METHODS.map(([v, l]) => (
                <button key={v} onClick={() => setMethod(v)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold ${method === v ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}>
                  {l}
                </button>
              ))}
            </div>
            <input value={contact} onChange={(e) => setContact(e.target.value)}
              placeholder={method === "telegram" ? "@username" : hi ? "मोबाइल नंबर" : "Mobile number"}
              className="mb-3 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm" />
            <button onClick={sendOtp} disabled={busy || !contact} className="btn-primary w-full">
              {hi ? "OTP भेजें" : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-slate-500">{hi ? "भेजा गया 6-अंकों का कोड डालें" : "Enter the 6-digit code we sent"}</p>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6}
              className="mb-3 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-center text-xl font-extrabold tracking-[0.4em]" />
            <button onClick={verifyOtp} disabled={busy || code.length !== 6} className="btn-primary w-full">
              {hi ? "सत्यापित करें" : "Verify"}
            </button>
          </>
        )}
        {err && <p className="mt-2 text-sm font-bold text-red-600">{err}</p>}
      </div>
    </div>
  );
}
