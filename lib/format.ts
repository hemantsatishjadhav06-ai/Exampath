import type { Locale } from "@/lib/site-config";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_HI = ["जन","फ़र","मार्च","अप्रै","मई","जून","जुल","अग","सित","अक्टू","नव","दिस"];

export function fmtDate(iso: string | null | undefined, locale: Locale = "en"): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const mon = (locale === "hi" ? MONTHS_HI : MONTHS)[(m ?? 1) - 1];
  return `${String(d).padStart(2, "0")} ${mon} ${y}`;
}

export function daysLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(`${iso}T23:59:59`);
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

export function inr(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-IN");
}

export function timeAgo(ts: string | null | undefined, locale: Locale = "en"): string {
  if (!ts) return "";
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  const [h, d] = [Math.floor(s / 3600), Math.floor(s / 86400)];
  if (locale === "hi") {
    if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} मि पहले`;
    if (h < 24) return `${h} घं पहले`;
    return `${d} दिन पहले`;
  }
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}
