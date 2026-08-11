import raw from "@/data/exams.json";
import overrides from "@/data/verified-overrides.json";
import type {
  Body,
  Cycle,
  ExamData,
  KeyDate,
  DeadlineHit,
  SearchArgs,
  QualCode,
} from "./types";
import { QUAL_RANK } from "./types";

const baseData = raw as unknown as ExamData;
const verifiedOverrides = overrides as Record<string, Partial<Cycle>>;

// Keep the generated dataset as the baseline, but apply explicitly reviewed
// source-backed corrections before anything reaches the UI. This prevents a
// stale scraper output from silently overriding a verified fact.
const data: ExamData = {
  ...baseData,
  cycles: baseData.cycles.map((cycle) => ({
    ...cycle,
    ...(verifiedOverrides[cycle.id] ?? {}),
  })),
};

/* ---------- accessors ---------- */
export function getBodies(): Body[] {
  return data.bodies;
}
export function getCycles(): Cycle[] {
  return data.cycles;
}
export function getCycle(id: string): Cycle | undefined {
  return data.cycles.find((c) => c.id === id);
}
export function getBody(slug: string): Body | undefined {
  return data.bodies.find((b) => b.slug === slug);
}
export function cyclesByBody(slug: string): Cycle[] {
  return data.cycles.filter((c) => c.body === slug);
}
export function relatedCycles(cycle: Cycle): Cycle[] {
  return cycle.related
    .map((id) => getCycle(id))
    .filter((c): c is Cycle => Boolean(c));
}

/* ---------- dates ---------- */
export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}
export function fmt(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS[m]} ${y}`;
}
export function fmtShort(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS[m]}`;
}
export function dayOf(iso: string): number {
  return parseISO(iso).d;
}
export function monthOf(iso: string): string {
  return MONTHS[parseISO(iso).m];
}

export function inr(n: number): string {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

export function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + pct;
  let g = ((n >> 8) & 255) + pct;
  let b = (n & 255) + pct;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return "#" + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export const FEED_ICON: Record<string, [string, string]> = {
  date: ["\u{1F4C5}", "var(--amber-soft)"],
  admit: ["\u{1F3AB}", "var(--brand-soft)"],
  new: ["\u{1F195}", "var(--green-soft)"],
  info: ["ℹ️", "#eef1f5"],
  result: ["\u{1F3C6}", "var(--green-soft)"],
};

/* ---------- deadlines ---------- */
export function nextDeadline(cycle: Cycle): KeyDate | undefined {
  const openDeadlines = cycle.dates
    .filter((d) => d.is_deadline && daysLeft(d.date) >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return openDeadlines[0] || cycle.dates.find((d) => d.is_deadline) || cycle.dates[0];
}

export function upcomingDeadlines(): DeadlineHit[] {
  const hits: DeadlineHit[] = [];
  for (const cycle of data.cycles) {
    for (const date of cycle.dates) {
      if (date.is_deadline && daysLeft(date.date) >= 0) {
        hits.push({ cycle, date });
      }
    }
  }
  return hits.sort(
    (a, b) => new Date(a.date.date).getTime() - new Date(b.date.date).getTime(),
  );
}

export function calendarDates(): DeadlineHit[] {
  const hits: DeadlineHit[] = [];
  for (const cycle of data.cycles) {
    for (const date of cycle.dates) {
      if (daysLeft(date.date) >= -3) hits.push({ cycle, date });
    }
  }
  return hits.sort(
    (a, b) => new Date(a.date.date).getTime() - new Date(b.date.date).getTime(),
  );
}

export function totalVacancies(): number {
  return data.cycles.reduce((s, c) => s + c.vacancy, 0);
}

/* ---------- updates feed ---------- */
export interface FeedItem {
  cycleId: string;
  title: string;
  text: string;
  kind: string;
  when: string;
}

function whenRank(when: string): number {
  const m = when.match(/(\d+)\s*([hdmw])/i);
  if (!m) return 9999;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = unit === "h" ? 1 / 24 : unit === "d" ? 1 : unit === "w" ? 7 : 1;
  return n * mult;
}

export function latestUpdates(limit = 8): FeedItem[] {
  const items: FeedItem[] = [];
  for (const c of data.cycles) {
    for (const u of c.updates) {
      items.push({ cycleId: c.id, title: c.exam, text: u.text, kind: u.kind, when: u.when });
    }
  }
  items.sort((a, b) => whenRank(a.when) - whenRank(b.when));
  return items.slice(0, limit);
}

/* ---------- search ---------- */
export function searchCycles({ q, age, qual, body, closingSoon }: SearchArgs): Cycle[] {
  return data.cycles.filter((c) => {
    if (body && c.body !== body) return false;
    if (qual && c.qualification_code !== qual) return false;
    if (age != null && !(age >= c.age_min && age <= c.age_max)) return false;
    if (closingSoon) {
      const soon = c.dates.some(
        (d) => d.is_deadline && daysLeft(d.date) >= 0 && daysLeft(d.date) <= 30,
      );
      if (!soon) return false;
    }
    if (q && !body && !qual && !closingSoon) {
      const hay = (c.title + c.exam + c.summary + c.posts).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
}

export function parseQuery(qraw: string): SearchArgs & { labels: string[] } {
  const q = (qraw || "").toLowerCase().trim();
  const ageMatch = q.match(/age\s*(\d{2})|(\d{2})\s*(?:yrs?|years?)|\b(1[89]|2[0-9]|3[0-5])\b/);
  const age = ageMatch ? parseInt(ageMatch[1] || ageMatch[2] || ageMatch[3], 10) : null;

  let qual: QualCode | null = null;
  if (/graduat|degree|b\.?a|b\.?sc|b\.?com|b\.?tech/.test(q)) qual = "graduate";
  else if (/12th|higher second|intermediate/.test(q)) qual = "12th";
  else if (/10th|matric/.test(q)) qual = "10th";

  let body: string | null = null;
  for (const b of data.bodies) {
    if (q.includes(b.short.toLowerCase()) || q.includes(b.name.toLowerCase().split(" ")[0])) {
      body = b.slug;
    }
  }
  if (/bank/.test(q)) body = "ibps";
  if (/rail|train/.test(q)) body = "rrb";

  const closingSoon = /clos|soon|deadline|last date/.test(q);

  const qualLabel: Record<QualCode, string> = {
    graduate: "Graduate",
    "12th": "12th pass",
    "10th": "10th pass",
    pg: "Post-graduate",
  };
  const labels = [
    body ? getBody(body)?.short : null,
    qual ? qualLabel[qual] : null,
    age ? `Age ${age}` : null,
    closingSoon ? "Closing soon" : null,
  ].filter((x): x is string => Boolean(x));

  return { q, age, qual, body, closingSoon, labels };
}
