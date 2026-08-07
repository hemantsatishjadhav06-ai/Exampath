"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Cycle } from "@/lib/types";
import { parseQuery, searchCycles } from "@/lib/data";
import ExamCard from "./ExamCard";

const CHIPS = ["graduate", "12th", "banking", "closing soon", "ssc", "upsc"];

export default function SearchClient({
  cycles,
  serverNow,
}: {
  cycles: Cycle[];
  serverNow: number;
}) {
  const [q, setQ] = useState("");
  const [now, setNow] = useState(serverNow);

  // Read the ?q= param on the client only (static export has no request-time
  // search params). Seeding `now` from the server keeps hydration stable.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQ(sp.get("q") || "");
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const parsed = useMemo(() => parseQuery(q), [q]);
  const results = useMemo(
    () => (q ? searchCycles(parsed) : cycles),
    [q, parsed, cycles],
  );

  return (
    <>
      <form
        className="searchbig"
        action="/search/"
        method="get"
        style={{ maxWidth: "100%", boxShadow: "var(--sh-s)", border: "1px solid var(--line)" }}
      >
        <input
          id="pageSearch"
          name="q"
          key={q}
          defaultValue={q}
          placeholder="Search exams, eligibility, body…"
          aria-label="Search exams"
        />
        <button className="btn pri" type="submit">
          Search
        </button>
      </form>

      <div className="filters" style={{ marginTop: 16 }}>
        {CHIPS.map((f) => (
          <Link
            key={f}
            className={`fchip ${q.toLowerCase().includes(f) ? "on" : ""}`}
            href={`/search/?q=${encodeURIComponent(f)}`}
          >
            {f}
          </Link>
        ))}
      </div>

      {parsed.labels.length > 0 && (
        <div className="note-demo" style={{ marginBottom: 14 }}>
          🔎 Understood your search as:{" "}
          {parsed.labels.map((l, i) => (
            <span key={i}>
              {i > 0 ? " · " : " "}
              <b>{l}</b>
            </span>
          ))}
        </div>
      )}

      <div className="sec-title">
        <h2>
          {results.length} exam{results.length !== 1 ? "s" : ""}
          {q ? " found" : ""}
        </h2>
      </div>

      {results.length ? (
        <div className="exam-grid">
          {results.map((c) => (
            <ExamCard key={c.id} cycle={c} now={now} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>🔍</div>
          <h3 style={{ margin: "8px 0" }}>No matches</h3>
          <p className="muted">Try “graduate”, “SSC”, or “age 21”.</p>
        </div>
      )}
    </>
  );
}
