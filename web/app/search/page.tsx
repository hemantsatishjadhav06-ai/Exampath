import type { Metadata } from "next";
import Link from "next/link";
import { getCycles } from "@/lib/data";
import SearchClient from "@/components/SearchClient";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Search Government Exams — by eligibility, body & deadline | ExamPath",
  description:
    "Search Indian government exams by free text or filters: qualification (graduate, 12th, 10th), age, conducting body (SSC, UPSC, IBPS) or closing soon.",
};

export default function SearchPage() {
  const cycles = getCycles();
  return (
    <section className="page">
      <div className="wrap">
        <div className="crumb">
          <Link href="/">Home</Link> › <span>Search</span>
        </div>
        <SearchClient cycles={cycles} serverNow={Date.now()} />
        <Footer />
      </div>
    </section>
  );
}
