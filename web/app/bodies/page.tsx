import type { Metadata } from "next";
import Link from "next/link";
import { getBodies, getCycles } from "@/lib/data";
import ExamCard from "@/components/ExamCard";
import BodyCard from "@/components/BodyCard";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "All Government Exams & Conducting Bodies | ExamPath",
  description:
    "Browse every tracked Indian government exam by conducting body — SSC, UPSC, IBPS, RRB and state PSCs — with live dates, vacancies and eligibility.",
};

export default function BodiesPage() {
  const bodies = getBodies();
  const cycles = getCycles();
  return (
    <section className="page">
      <div className="wrap">
        <div className="crumb">
          <Link href="/">Home</Link> › <span>All exams</span>
        </div>
        <div className="sec-title">
          <h2>Browse by conducting body</h2>
        </div>
        <div className="body-grid blk">
          {bodies.map((b) => (
            <BodyCard key={b.slug} body={b} />
          ))}
        </div>
        <div className="sec-title">
          <h2>All tracked exams</h2>
        </div>
        <div className="exam-grid">
          {cycles.map((c) => (
            <ExamCard key={c.id} cycle={c} />
          ))}
        </div>
        <Footer />
      </div>
    </section>
  );
}
