import type { Locale } from "@/lib/site-config";
import { t } from "@/lib/i18n";

/** auto_verified & manual_verified both display as "Verified" (per spec). */
export default function VerifyBadge({ status, locale }: { status: string; locale: Locale }) {
  const s = t(locale);
  if (status === "rejected") return null;
  const verified = status === "auto_verified" || status === "manual_verified";
  return (
    <span className={`pill ${verified ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      {verified ? "✓ " + s.verified : s.unverified}
    </span>
  );
}
