import Link from "next/link";
import {
  getBodies,
  getCycles,
  getCycle,
  daysLeft,
  fmt,
  inr,
  latestUpdates,
} from "@/lib/data";
import ExamCard from "@/components/ExamCard";
import BodyCard from "@/components/BodyCard";
import Feed from "@/components/Feed";
import Footer from "@/components/Footer";
import Countdown from "@/components/Countdown";
import HeroSearch from "@/components/HeroSearch";

const FEATURED = [
  "ssc-cgl-2026",
  "upsc-cse-2026",
  "ibps-po-2026",
  "ssc-chsl-2026",
  "rrb-ntpc-2026",
  "mppsc-ss-2026",
];

export default function HomePage() {
  const cycles = getCycles();
  const bodies = getBodies();

  // one nearest open deadline per cycle, soonest first
  const soon = cycles
    .filter((c) => c.dates.some((d) => d.is_deadline && daysLeft(d.date) >= 0))
    .map((c) => ({
      c,
      d: c.dates
        .filter((x) => x.is_deadline && daysLeft(x.date) >= 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0],
    }))
    .sort((a, b) => new Date(a.d.date).getTime() - new Date(b.d.date).getTime());

  const featured = FEATURED.map(getCycle).filter(Boolean);
  const totalVac = cycles.reduce((s, c) => s + c.vacancy, 0);
  const updates = latestUpdates(6);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <span className="eyebrow">
            🇮🇳 {cycles.length} live exams &middot; {bodies.length} bodies &middot; updated daily
          </span>
          <h1>
            Every government exam. <span className="u">Every date.</span> One place.
          </h1>
          <p className="sub">
            Notifications, deadlines, vacancies, eligibility and results — compiled from
            official sources and always current. Never miss a form again.
          </p>
          <HeroSearch />
          <div className="chips">
            <Link className="c" href="/search/?q=graduate">
              🎓 Graduate exams
            </Link>
            <Link className="c" href="/search/?q=12th">
              📗 12th pass
            </Link>
            <Link className="c" href="/search/?q=banking">
              🏦 Banking
            </Link>
            <Link className="c" href="/search/?q=closing%20soon">
              ⏰ Closing soon
            </Link>
          </div>
          <div className="hero-stats">
            <div className="s">
              <b>{inr(totalVac)}+</b>
              <span>Total vacancies tracked</span>
            </div>
            <div className="s">
              <b>{soon.length}</b>
              <span>Deadlines this month</span>
            </div>
            <div className="s">
              <b>100%</b>
              <span>Official-source verified</span>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap pull">
        <div className="blk">
          <div className="sec-title">
            <h2 style={{ color: "#fff" }}>⏰ Closing soon</h2>
            <Link href="/calendar/" style={{ color: "#dbe6fe" }}>
              Full calendar &rarr;
            </Link>
          </div>
          <div className="dl-strip">
            {soon.map(({ c, d }) => (
              <Link className="dl-card" href={`/exam/${c.id}/`} key={c.id}>
                <div className="cd">
                  <Countdown iso={d.date} initialDays={daysLeft(d.date)} />
                </div>
                <h4>{c.title}</h4>
                <div className="small muted">
                  {d.label} &middot; {fmt(d.date)}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="blk">
          <div className="sec-title">
            <h2>Popular exams</h2>
            <Link href="/bodies/">Browse all &rarr;</Link>
          </div>
          <div className="exam-grid">
            {featured.map((c) => (
              <ExamCard key={c!.id} cycle={c!} />
            ))}
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}
          className="blk home-2col"
        >
          <div>
            <div className="sec-title">
              <h2>Browse by body</h2>
            </div>
            <div className="body-grid">
              {bodies.map((b) => (
                <BodyCard key={b.slug} body={b} />
              ))}
            </div>
          </div>
          <div>
            <div className="sec-title">
              <h2>Latest updates</h2>
            </div>
            <div className="card" style={{ padding: "6px 16px" }}>
              <Feed items={updates} />
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
