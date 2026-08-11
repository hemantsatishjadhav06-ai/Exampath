import Link from "next/link";
import { getBodies, getCycles, getCycle, daysLeft, fmt, inr, latestUpdates } from "@/lib/data";
import ExamCard from "@/components/ExamCard";
import BodyCard from "@/components/BodyCard";
import Feed from "@/components/Feed";
import Footer from "@/components/Footer";
import Countdown from "@/components/Countdown";
import HeroSearch from "@/components/HeroSearch";

const FEATURED = ["ssc-cgl-2026", "upsc-cse-2026", "ibps-po-2026", "ssc-chsl-2026", "rrb-ntpc-2026", "mppsc-ss-2026"];

export default function HomePage() {
  const cycles = getCycles();
  const bodies = getBodies();
  const soon = cycles
    .filter((c) => c.dates.some((d) => d.is_deadline && daysLeft(d.date) >= 0))
    .map((c) => ({ c, d: c.dates.filter((x) => x.is_deadline && daysLeft(x.date) >= 0).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] }))
    .sort((a, b) => new Date(a.d.date).getTime() - new Date(b.d.date).getTime());
  const featured = FEATURED.map(getCycle).filter(Boolean);
  const totalVac = cycles.reduce((s, c) => s + c.vacancy, 0);
  const updates = latestUpdates(6);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <span className="eyebrow">🇮🇳 {cycles.length} tracked exams · {bodies.length} bodies · source-linked data</span>
          <h1>Every government exam. <span className="u">Every date.</span> One place.</h1>
          <p className="sub">Find notifications, deadlines, vacancies, eligibility and results. ExamPath links each important claim to an official source where source evidence is available.</p>
          <HeroSearch />
          <div className="chips">
            <Link className="c" href="/search/?q=graduate">🎓 Graduate exams</Link>
            <Link className="c" href="/search/?q=12th">📗 12th pass</Link>
            <Link className="c" href="/search/?q=banking">🏦 Banking</Link>
            <Link className="c" href="/search/?q=closing%20soon">⏰ Closing soon</Link>
          </div>
          <div className="hero-stats">
            <div className="s"><b>{inr(totalVac)}+</b><span>Vacancies across tracked records*</span></div>
            <div className="s"><b>{soon.length}</b><span>Currently visible open deadlines</span></div>
            <div className="s"><b>Official</b><span>Source links shown per exam</span></div>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>* Vacancy totals may include tentative figures. Always check the official notification for the latest number.</p>
        </div>
      </section>

      <div className="wrap pull">
        {soon.length > 0 && <div className="blk"><div className="sec-title"><h2 style={{ color: "#fff" }}>⏰ Closing soon</h2><Link href="/calendar/" style={{ color: "#dbe6fe" }}>Full calendar →</Link></div><div className="dl-strip">{soon.map(({ c, d }) => <Link className="dl-card" href={`/exam/${c.id}/`} key={c.id}><div className="cd"><Countdown iso={d.date} initialDays={daysLeft(d.date)} /></div><h4>{c.title}</h4><div className="small muted">{d.label} · {fmt(d.date)}</div></Link>)}</div></div>}

        <div className="blk"><div className="sec-title"><h2>Popular exams</h2><Link href="/bodies/">Browse all →</Link></div><div className="exam-grid">{featured.map((c) => c && <ExamCard key={c.id} cycle={c} />)}</div></div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }} className="blk home-2col">
          <div><div className="sec-title"><h2>Browse by body</h2></div><div className="body-grid">{bodies.map((b) => <BodyCard key={b.slug} body={b} />)}</div></div>
          <div><div className="sec-title"><h2>Latest updates</h2></div><div className="card" style={{ padding: "6px 16px" }}><Feed items={updates} /></div></div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 20 }}>How to use ExamPath safely</h2>
          <p className="small muted" style={{ marginBottom: 8 }}>Use ExamPath to discover and compare exams, then open the linked official notification before you apply. ExamPath is an independent information platform, not a government website.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><span className="tag">1. Discover</span><span className="tag">2. Check dates</span><span className="tag">3. Open official source</span><span className="tag">4. Verify eligibility</span><span className="tag">5. Apply on the official portal</span></div>
        </div>
        <Footer />
      </div>
    </>
  );
}
