import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCycles,
  getCycle,
  getBody,
  relatedCycles,
  nextDeadline,
  daysLeft,
  fmt,
  fmtShort,
  dayOf,
  monthOf,
  inr,
  FEED_ICON,
} from "@/lib/data";
import type { Cycle, Body } from "@/lib/types";
import StatusPill from "@/components/StatusPill";
import DashCountdown from "@/components/DashCountdown";
import EligibilityChecker from "@/components/EligibilityChecker";
import FollowButton from "@/components/FollowButton";
import Footer from "@/components/Footer";

export function generateStaticParams() {
  return getCycles().map((c) => ({ id: c.id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const c = getCycle(params.id);
  if (!c) return { title: "Exam | ExamPath" };
  return {
    title: `${c.title} — Dates, Vacancy, Eligibility & Apply | ExamPath`,
    description: `${c.title}: ${c.summary} ${inr(c.vacancy)} vacancies, age ${c.age_min}–${c.age_max}, ${c.qualification}. Live countdown, timeline, cut-offs and official links.`,
  };
}

function jobPostingLD(c: Cycle, b: Body): string {
  const notif = c.stages.find((s) => /notif/i.test(s.name) && s.date) ?? c.stages.find((s) => s.date);
  const lastDeadline = [...c.dates].reverse().find((d) => d.is_deadline) ?? c.dates[c.dates.length - 1];
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: c.title,
    description: `${c.summary} Posts: ${c.posts}`,
    datePosted: notif ? notif.date : c.dates[0]?.date,
    validThrough: lastDeadline ? lastDeadline.date : undefined,
    employmentType: "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: b.name, sameAs: b.official_url },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressCountry: "IN", addressRegion: "India" },
    },
    totalJobOpenings: c.vacancy,
  };
  return JSON.stringify(obj);
}

export default function ExamPage({ params }: { params: { id: string } }) {
  const c = getCycle(params.id);
  if (!c) notFound();
  const b = getBody(c.body)!;
  const dl = nextDeadline(c);
  const dleft = daysLeft(dl.date);
  const maxV = Math.max(...c.vacancy_history.map((v) => v.seats));

  return (
    <section className="page">
      <div className="wrap">
        <div className="crumb">
          <Link href="/">Home</Link> › <Link href={`/body/${b.slug}/`}>{b.short}</Link> ›{" "}
          <span>{c.title}</span>
        </div>

        <div className="dash-hero">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
              position: "relative",
              zIndex: 2,
            }}
          >
            <div>
              <div className="body-tag">{b.name}</div>
              <h1>{c.title}</h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <StatusPill status={c.status} />
                <span
                  className="tag"
                  style={{ background: "rgba(255,255,255,.12)", color: "#dbe6fe", borderColor: "rgba(255,255,255,.2)" }}
                >
                  {c.qualification}
                </span>
                <span
                  className="tag"
                  style={{ background: "rgba(255,255,255,.12)", color: "#dbe6fe", borderColor: "rgba(255,255,255,.2)" }}
                >
                  {inr(c.vacancy)} posts
                </span>
              </div>
            </div>
            <FollowButton id={c.id} variant="button" />
          </div>
          {dleft >= 0 ? (
            <>
              <div className="deadline-label">
                ⏰ {dl.label} &middot; {fmt(dl.date)}
              </div>
              <DashCountdown iso={dl.date} initialDays={dleft} />
            </>
          ) : (
            <div className="deadline-label">
              Key dates to be announced — follow to get notified.
            </div>
          )}
        </div>

        <div className="dash-grid">
          <div>
            <div className="panel">
              <h3>
                <span className="n">1</span> Timeline
              </h3>
              <div className="timeline">
                {c.stages.map((s, i) => {
                  const isNow = !s.done && (i === 0 || c.stages[i - 1].done);
                  return (
                    <div className={`tl-node ${s.done ? "done" : ""} ${isNow ? "now" : ""}`} key={i}>
                      <span className="dot" />
                      <b>{s.name}</b>
                      <span>{s.date ? fmtShort(s.date) : "TBA"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <h3>
                <span className="n">2</span> Important dates
              </h3>
              {c.dates.map((d, i) => {
                const dlft = daysLeft(d.date);
                const color =
                  d.is_deadline && dlft >= 0 && dlft <= 7
                    ? "var(--red)"
                    : dlft < 0
                      ? "var(--muted)"
                      : "var(--brand)";
                const rt = dlft < 0 ? "Done" : dlft === 0 ? "Today" : `${dlft} days`;
                return (
                  <div className="kd" key={i}>
                    <div className="date">
                      <b>{dayOf(d.date)}</b>
                      <span>{monthOf(d.date)}</span>
                    </div>
                    <div className="lab">
                      <b>{d.label}</b>
                      <br />
                      <span>{fmt(d.date)}</span>
                    </div>
                    <div className="rt" style={{ color }}>
                      {rt}
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
                <div className="small muted" style={{ marginBottom: 6 }}>
                  Selection process
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {c.selection.map((x, i) => (
                    <span className="tag" key={i}>
                      {i + 1}. {x}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel">
              <h3>
                <span className="n">3</span> Vacancy trend{" "}
                <span className="small muted" style={{ fontWeight: 600, marginLeft: "auto" }}>
                  last {c.vacancy_history.length} years
                </span>
              </h3>
              <div className="bars">
                {c.vacancy_history.map((v, i) => (
                  <div className="b" key={i}>
                    <div
                      className={`bar ${i === c.vacancy_history.length - 1 ? "hl" : ""}`}
                      style={{ height: `${Math.max(8, Math.round((v.seats / maxV) * 100))}%` }}
                    >
                      <span>
                        {v.seats >= 1000
                          ? (v.seats / 1000).toFixed(v.seats % 1000 ? 1 : 0) + "k"
                          : v.seats}
                      </span>
                    </div>
                    <em>{v.year}</em>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h3>
                <span className="n">4</span> Previous cut-offs{" "}
                <span className="small muted" style={{ fontWeight: 600, marginLeft: "auto" }}>
                  out of 100
                </span>
              </h3>
              <table className="dtable">
                <tbody>
                  <tr>
                    <th>Category</th>
                    <th>Cut-off</th>
                    <th></th>
                  </tr>
                  {c.cutoffs.map((o, i) => (
                    <tr key={i}>
                      <td>
                        <b>{o.category}</b>
                      </td>
                      <td>{o.marks}</td>
                      <td style={{ width: "55%" }}>
                        <div style={{ height: 8, borderRadius: 6, background: "var(--brand-soft)" }}>
                          <div
                            style={{
                              height: 8,
                              borderRadius: 6,
                              width: `${Math.min(100, o.marks)}%`,
                              background: "var(--brand)",
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <EligibilityChecker
              exam={c.exam}
              qualification={c.qualification}
              qualCode={c.qualification_code}
              ageMin={c.age_min}
              ageMax={c.age_max}
            />

            <div className="panel">
              <h3>🆕 What&apos;s new</h3>
              <div className="feed">
                {c.updates.map((u, i) => {
                  const ic = FEED_ICON[u.kind] ?? FEED_ICON.info;
                  return (
                    <div className="it" style={{ cursor: "default" }} key={i}>
                      <div className="ic" style={{ background: ic[1] }}>
                        {ic[0]}
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 600, fontSize: "13.5px" }}>{u.text}</h4>
                        <p>{u.when}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <h3>🔗 Official sources</h3>
              {c.links.map((l, i) => (
                <a className="src" href={l.url} target="_blank" rel="noopener" key={i}>
                  <div className="ic">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </div>
                  <div>
                    <b>{l.label}</b>
                    <br />
                    <span>{l.kind} &middot; verified</span>
                  </div>
                  <span className="go">Open ↗</span>
                </a>
              ))}
            </div>

            <div className="panel">
              <h3>🔀 Related exams</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {relatedCycles(c).map((r) => {
                  const rb = getBody(r.body)!;
                  return (
                    <Link className="src" style={{ width: "100%", textAlign: "left" }} href={`/exam/${r.id}/`} key={r.id}>
                      <span
                        className="badge"
                        style={{ width: 34, height: 34, background: `${rb.color}1a`, color: rb.color }}
                      >
                        {rb.short}
                      </span>
                      <div>
                        <b>{r.exam}</b>
                        <br />
                        <span>
                          {r.qualification} &middot; {inr(r.vacancy)} posts
                        </span>
                      </div>
                      <span className="go">View &rarr;</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jobPostingLD(c, b) }}
      />
    </section>
  );
}
