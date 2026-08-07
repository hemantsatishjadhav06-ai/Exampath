import type { Metadata } from "next";
import Link from "next/link";
import { calendarDates, daysLeft, fmt, dayOf, monthOf } from "@/lib/data";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Exam Calendar — Upcoming Government Exam Deadlines | ExamPath",
  description:
    "Every upcoming Indian government exam deadline in one calendar, sorted by date with live days-left counters. SSC, UPSC, IBPS, RRB and state PSCs.",
};

export default function CalendarPage() {
  const all = calendarDates();
  return (
    <section className="page">
      <div className="wrap">
        <div className="crumb">
          <Link href="/">Home</Link> › <span>Calendar</span>
        </div>
        <div className="sec-title">
          <h2>📅 Deadline calendar</h2>
          <span className="small muted">{all.length} upcoming dates</span>
        </div>
        <div className="card" style={{ padding: "6px 18px" }}>
          {all.map(({ cycle, date }, i) => {
            const dlft = daysLeft(date.date);
            const hot = date.is_deadline && dlft <= 7 && dlft >= 0;
            const rt = dlft < 0 ? "Passed" : dlft === 0 ? "Today" : `${dlft}d`;
            return (
              <Link className="kd" href={`/exam/${cycle.id}/`} style={{ cursor: "pointer" }} key={i}>
                <div
                  className="date"
                  style={hot ? { background: "var(--red-soft)", color: "var(--red)" } : undefined}
                >
                  <b>{dayOf(date.date)}</b>
                  <span>{monthOf(date.date)}</span>
                </div>
                <div className="lab">
                  <b>
                    {cycle.exam} — {date.label}
                  </b>
                  <br />
                  <span>
                    {cycle.title} &middot; {fmt(date.date)}
                  </span>
                </div>
                <div
                  className="rt"
                  style={{ color: hot ? "var(--red)" : dlft < 0 ? "var(--muted)" : "var(--brand)" }}
                >
                  {rt}
                </div>
              </Link>
            );
          })}
        </div>
        <Footer />
      </div>
    </section>
  );
}
