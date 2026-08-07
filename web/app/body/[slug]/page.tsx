import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getBodies,
  getBody,
  cyclesByBody,
  inr,
  shade,
  parseISO,
  MONTHS,
} from "@/lib/data";
import type { Status } from "@/lib/types";
import ExamCard from "@/components/ExamCard";
import Feed, { type FeedRow } from "@/components/Feed";
import Footer from "@/components/Footer";

export function generateStaticParams() {
  return getBodies().map((b) => ({ slug: b.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const b = getBody(params.slug);
  if (!b) return { title: "Conducting body | ExamPath" };
  const list = cyclesByBody(b.slug);
  const totalVac = list.reduce((s, c) => s + c.vacancy, 0);
  return {
    title: `${b.short} — ${b.name}: Exams, Dates & Vacancies | ExamPath`,
    description: `All ${b.short} (${b.name}) exams tracked on ExamPath — ${list.length} exam${
      list.length > 1 ? "s" : ""
    }, ${inr(totalVac)} vacancies. Notifications, deadlines and eligibility.`,
  };
}

const GROUP_ORDER: { label: string; statuses: Status[] }[] = [
  { label: "Current / Open", statuses: ["application_open", "closing_soon", "admit_card"] },
  { label: "Upcoming", statuses: ["upcoming"] },
  { label: "Results & Past", statuses: ["result_awaited", "result_out", "completed"] },
];

export default function BodyPage({ params }: { params: { slug: string } }) {
  const b = getBody(params.slug);
  if (!b) notFound();
  const list = cyclesByBody(b.slug);
  const totalVac = list.reduce((s, c) => s + c.vacancy, 0);

  const monthHas: Record<number, boolean> = {};
  list.forEach((c) => c.dates.forEach((d) => (monthHas[parseISO(d.date).m] = true)));

  const updates: FeedRow[] = list
    .flatMap((c) => c.updates.map((u) => ({ cycleId: c.id, title: c.exam, text: u.text, kind: u.kind, when: u.when })))
    .slice(0, 5);

  return (
    <section className="page">
      <div className="wrap">
        <div className="crumb">
          <Link href="/">Home</Link> › <Link href="/bodies/">Exams</Link> › <span>{b.short}</span>
        </div>
        <div
          className="dash-hero"
          style={{ background: `linear-gradient(135deg,${b.color},${shade(b.color, -24)})` }}
        >
          <div className="body-tag">{b.level} &middot; Conducting Body</div>
          <h1>{b.name}</h1>
          <p style={{ color: "#e6eefc", margin: "6px 0 0", maxWidth: 560 }}>
            Tracking {list.length} exam{list.length > 1 ? "s" : ""} &middot; {inr(totalVac)}{" "}
            vacancies. Current openings, calendar and the latest official updates.
          </p>
        </div>

        <div className="dash-grid">
          <div>
            {GROUP_ORDER.map(({ label, statuses }) => {
              const arr = list.filter((c) => statuses.includes(c.status));
              if (!arr.length) return null;
              return (
                <div className="panel" key={label}>
                  <h3>
                    {label}{" "}
                    <span className="tag" style={{ marginLeft: 6 }}>
                      {arr.length}
                    </span>
                  </h3>
                  <div
                    className="exam-grid"
                    style={{ marginTop: 12, gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}
                  >
                    {arr.map((c) => (
                      <ExamCard key={c.id} cycle={c} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <div className="panel">
              <h3>📅 Exam calendar</h3>
              <div className="months">
                {MONTHS.map((m, i) => (
                  <div className={`m ${monthHas[i] ? "has" : ""}`} key={m}>
                    <b>{m}</b>
                    <span>{monthHas[i] ? "●" : " "}</span>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ margin: "6px 0 0" }}>
                Highlighted months have scheduled dates.
              </p>
            </div>
            <div className="panel">
              <h3>🔔 Latest updates</h3>
              <Feed items={updates} />
            </div>
            <div className="panel">
              <h3>🔗 Official website</h3>
              <a className="src" href={b.official_url} target="_blank" rel="noopener">
                <div className="ic">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </div>
                <div>
                  <b>{b.name}</b>
                  <br />
                  <span>{b.official_url.replace(/^https?:\/\//, "")}</span>
                </div>
                <span className="go">Open ↗</span>
              </a>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </section>
  );
}
