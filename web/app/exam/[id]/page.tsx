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
import SourceTrust from "@/components/SourceTrust";
import Footer from "@/components/Footer";

export function generateStaticParams() {
  return getCycles().map((c) => ({ id: c.id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const c = getCycle(params.id);
  if (!c) return { title: "Exam | ExamPath" };
  const verified = c.verification?.status === "verified" ? " Official-source checked." : " Verify against the official notification before applying.";
  return {
    title: `${c.title} — Dates, Vacancy, Eligibility & Official Notification | ExamPath`,
    description: `${c.title}: ${c.summary} ${inr(c.vacancy)} vacancies, ${c.qualification}. Dates, eligibility, selection process and official source. ${verified}`,
    alternates: { canonical: `/exam/${c.id}/` },
  };
}

function structuredData(c: Cycle, b: Body) {
  const faq = [
    { "@type": "Question", name: `What is ${c.title}?`, acceptedAnswer: { "@type": "Answer", text: c.summary } },
    { "@type": "Question", name: `How many vacancies are there in ${c.title}?`, acceptedAnswer: { "@type": "Answer", text: `${c.vacancy_note ? c.vacancy_note : `${inr(c.vacancy)} vacancies are currently listed in ExamPath.`} Verify the latest vacancy notice on the official source.` } },
    { "@type": "Question", name: `What qualification is required for ${c.title}?`, acceptedAnswer: { "@type": "Answer", text: `The basic qualification listed is ${c.qualification}. Post-specific educational requirements may differ.` } },
    { "@type": "Question", name: `What is the age range for ${c.title}?`, acceptedAnswer: { "@type": "Answer", text: `The broad age range represented in this record is ${c.age_min}–${c.age_max} years. Exact age limits and the cut-off date can vary by post and category.` } },
  ];

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: c.title,
      description: c.summary,
      about: { "@type": "Thing", name: c.exam },
      isPartOf: { "@type": "WebSite", name: "ExamPath" },
      ...(c.verification ? { citation: c.verification.source_url } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "/" },
        { "@type": "ListItem", position: 2, name: b.name, item: `/body/${b.slug}/` },
        { "@type": "ListItem", position: 3, name: c.title, item: `/exam/${c.id}/` },
      ],
    },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq },
  ];
}

export default function ExamPage({ params }: { params: { id: string } }) {
  const c = getCycle(params.id);
  if (!c) notFound();
  const b = getBody(c.body)!;
  const dl = nextDeadline(c);
  const dleft = dl ? daysLeft(dl.date) : -1;
  const maxV = c.vacancy_history.length ? Math.max(...c.vacancy_history.map((v) => v.seats)) : 0;
  const upcomingStage = c.stages.find((s) => s.date && daysLeft(s.date) >= 0);
  const faqItems = [
    { q: `What is ${c.title}?`, a: c.summary },
    { q: `How many vacancies are there?`, a: c.vacancy_note || `${inr(c.vacancy)} vacancies are listed in this record. Always confirm the latest official vacancy notice.` },
    { q: `What qualification is required?`, a: `${c.qualification} is the basic qualification represented here. Post-specific requirements can differ.` },
    { q: `What is the age limit?`, a: `${c.age_min}–${c.age_max} years is the broad range represented here. Exact post/category limits and the age cut-off date must be checked in the notification.` },
  ];

  return (
    <section className="page">
      <div className="wrap">
        <div className="crumb">
          <Link href="/">Home</Link> › <Link href={`/body/${b.slug}/`}>{b.short}</Link> › <span>{c.title}</span>
        </div>

        <div className="dash-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", position: "relative", zIndex: 2 }}>
            <div>
              <div className="body-tag">{b.name}</div>
              <h1>{c.title}</h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <StatusPill status={c.status} />
                <span className="tag" style={{ background: "rgba(255,255,255,.12)", color: "#dbe6fe", borderColor: "rgba(255,255,255,.2)" }}>{c.qualification}</span>
                <span className="tag" style={{ background: "rgba(255,255,255,.12)", color: "#dbe6fe", borderColor: "rgba(255,255,255,.2)" }}>{inr(c.vacancy)} {c.vacancy_note ? "tentative vacancies" : "posts"}</span>
              </div>
            </div>
            <FollowButton id={c.id} variant="button" />
          </div>
          {dleft >= 0 && dl ? (
            <>
              <div className="deadline-label">⏰ {dl.label} · {fmt(dl.date)}</div>
              <DashCountdown iso={dl.date} initialDays={dleft} />
            </>
          ) : upcomingStage ? (
            <div className="deadline-label">Next scheduled milestone: {upcomingStage.name} · {fmt(upcomingStage.date!)}</div>
          ) : (
            <div className="deadline-label">Applications are closed or no exact upcoming date has been published.</div>
          )}
        </div>

        <SourceTrust cycle={c} />

        <div className="panel" style={{ background: "#fff", marginBottom: 16 }}>
          <h2 style={{ fontSize: 21, marginBottom: 8 }}>Quick answers</h2>
          <p style={{ margin: "0 0 14px", color: "var(--muted)" }}>{c.summary}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            <div className="card" style={{ padding: 12 }}><b>Vacancies</b><div>{inr(c.vacancy)}{c.vacancy_note ? " tentative" : ""}</div></div>
            <div className="card" style={{ padding: 12 }}><b>Qualification</b><div>{c.qualification}</div></div>
            <div className="card" style={{ padding: 12 }}><b>Age range</b><div>{c.age_min}–{c.age_max} years*</div></div>
            <div className="card" style={{ padding: 12 }}><b>Conducting body</b><div>{b.name}</div></div>
          </div>
          {c.schedule_note && <p className="small muted" style={{ margin: "12px 0 0" }}><b>Schedule note:</b> {c.schedule_note}</p>}
          {c.vacancy_note && <p className="small muted" style={{ margin: "6px 0 0" }}><b>Vacancy note:</b> {c.vacancy_note}</p>}
        </div>

        <div className="dash-grid">
          <div>
            <div className="panel">
              <h3><span className="n">1</span> Timeline</h3>
              <div className="timeline">
                {c.stages.map((s, i) => (
                  <div className={`tl-node ${s.done ? "done" : ""}`} key={i}>
                    <span className="dot" /><b>{s.name}</b><span>{s.date ? fmtShort(s.date) : s.precision === "tentative" ? "Tentative" : "TBA"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h3><span className="n">2</span> Important dates</h3>
              {c.dates.length ? c.dates.map((d, i) => {
                const dlft = daysLeft(d.date);
                const color = d.is_deadline && dlft >= 0 && dlft <= 7 ? "var(--red)" : dlft < 0 ? "var(--muted)" : "var(--brand)";
                const rt = dlft < 0 ? "Done" : dlft === 0 ? "Today" : `${dlft} days`;
                return (
                  <div className="kd" key={i}>
                    <div className="date"><b>{dayOf(d.date)}</b><span>{monthOf(d.date)}</span></div>
                    <div className="lab"><b>{d.label}</b><br /><span>{fmt(d.date)}</span></div>
                    <div className="rt" style={{ color }}>{rt}</div>
                  </div>
                );
              }) : <p className="muted">No exact dates are published in the verified record yet.</p>}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
                <div className="small muted" style={{ marginBottom: 6 }}>Selection process</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{c.selection.map((x, i) => <span className="tag" key={i}>{i + 1}. {x}</span>)}</div>
              </div>
            </div>

            <div className="panel">
              <h3><span className="n">3</span> Vacancy trend</h3>
              {c.vacancy_history.length && maxV ? (
                <div className="bars">{c.vacancy_history.map((v, i) => <div className="b" key={i}><div className={`bar ${i === c.vacancy_history.length - 1 ? "hl" : ""}`} style={{ height: `${Math.max(8, Math.round((v.seats / maxV) * 100))}%` }}><span>{v.seats >= 1000 ? (v.seats / 1000).toFixed(v.seats % 1000 ? 1 : 0) + "k" : v.seats}</span></div><em>{v.year}</em></div>)}</div>
              ) : <p className="muted">Historical vacancy figures are withheld here until they have their own source evidence.</p>}
            </div>

            <div className="panel">
              <h3><span className="n">4</span> Previous cut-offs</h3>
              {c.cutoffs.length ? <table className="dtable"><tbody><tr><th>Category</th><th>Cut-off</th><th>Relative bar</th></tr>{c.cutoffs.map((o, i) => <tr key={i}><td><b>{o.category}</b></td><td>{o.marks}</td><td><div style={{ height: 8, borderRadius: 6, background: "var(--brand-soft)" }}><div style={{ height: 8, borderRadius: 6, width: `${Math.min(100, o.marks)}%`, background: "var(--brand)" }} /></div></td></tr>)}</tbody></table> : <p className="muted">No verified cut-off figures are displayed for this cycle yet.</p>}
            </div>
          </div>

          <div>
            <EligibilityChecker exam={c.exam} qualification={c.qualification} qualCode={c.qualification_code} ageMin={c.age_min} ageMax={c.age_max} />

            <div className="panel">
              <h3>🆕 Verified updates</h3>
              <div className="feed">{c.updates.map((u, i) => { const ic = FEED_ICON[u.kind] ?? FEED_ICON.info; return <div className="it" style={{ cursor: "default" }} key={i}><div className="ic" style={{ background: ic[1] }}>{ic[0]}</div><div><h4 style={{ fontWeight: 600, fontSize: "13.5px" }}>{u.text}</h4><p>{u.when}</p>{u.source_url && <a href={u.source_url} target="_blank" rel="noopener noreferrer" className="small" style={{ color: "var(--brand)" }}>Source ↗</a>}</div></div>; })}</div>
            </div>

            <div className="panel">
              <h3>🔗 Official sources</h3>
              {c.links.map((l, i) => <a className="src" href={l.url} target="_blank" rel="noopener noreferrer" key={i}><div className="ic">✓</div><div><b>{l.label}</b><br /><span>{l.kind} · {l.verified ? "verified" : "source reference"}</span></div><span className="go">Open ↗</span></a>)}
            </div>

            <div className="panel">
              <h3>❓ Frequently asked questions</h3>
              {faqItems.map((item) => <details key={item.q} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-2)" }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>{item.q}</summary><p className="small muted" style={{ margin: "8px 0 0" }}>{item.a}</p></details>)}
            </div>

            <div className="panel">
              <h3>🔀 Related exams</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{relatedCycles(c).map((r) => { const rb = getBody(r.body)!; return <Link className="src" style={{ width: "100%", textAlign: "left" }} href={`/exam/${r.id}/`} key={r.id}><span className="badge" style={{ width: 34, height: 34, background: `${rb.color}1a`, color: rb.color }}>{rb.short}</span><div><b>{r.exam}</b><br /><span>{r.qualification} · {inr(r.vacancy)} posts</span></div><span className="go">View →</span></Link>; })}</div>
            </div>
          </div>
        </div>

        <p className="small muted" style={{ margin: "6px 0 18px" }}>* Age and eligibility summaries are screening aids. Exact post, category, cut-off-date, education, physical and medical requirements are controlled by the official notification.</p>
        <Footer />
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(c, b)) }} />
    </section>
  );
}
