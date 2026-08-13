"use client";
import { useState } from "react";
import AuthModal from "@/components/AuthModal";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/site-config";

export default function FollowButton({ cycleId, locale }: { cycleId: string; locale: Locale }) {
  const s = t(locale);
  const [open, setOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function follow() {
    setBusy(true);
    const res = await fetch("/api/follow", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycle_id: cycleId }),
    });
    setBusy(false);
    if (res.status === 401) { setOpen(true); return; }
    if (res.ok) setFollowing((f) => !f);
  }

  return (
    <>
      <button onClick={follow} disabled={busy}
        className={following ? "btn-ghost" : "btn-accent"} aria-pressed={following}>
        {following ? "✓ " + (locale === "hi" ? "फ़ॉलो किया" : "Following") : "☆ " + s.follow}
      </button>
      {open && <AuthModal locale={locale} onSuccess={() => { setOpen(false); follow(); }} onClose={() => setOpen(false)} />}
    </>
  );
}
