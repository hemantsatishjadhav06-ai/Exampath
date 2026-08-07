import Link from "next/link";
import type { Cycle } from "@/lib/types";
import { getBody, inr } from "@/lib/data";
import StatusPill from "./StatusPill";
import FollowButton from "./FollowButton";

// `now` lets a client parent (search) keep day-counts consistent across the
// server render and hydration; server pages use build-time Date.now().
export default function ExamCard({ cycle, now }: { cycle: Cycle; now?: number }) {
  const b = getBody(cycle.body)!;
  const dl = cycle.dates.find((d) => d.is_deadline);
  const ref = now ?? Date.now();
  const dleft = dl
    ? Math.ceil((new Date(dl.date).getTime() - ref) / 86400000)
    : null;

  return (
    <div className="xcard">
      <div className="row1">
        <span className="badge" style={{ background: `${b.color}1a`, color: b.color }}>
          {b.short}
        </span>
        <div style={{ minWidth: 0 }}>
          <h3>{cycle.exam}</h3>
          <div className="meta">
            {b.name.split(" ").slice(0, 3).join(" ")} &middot; {cycle.qualification}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <StatusPill status={cycle.status} />
        </div>
      </div>
      <div className="facts">
        <div className="f">
          <b>{inr(cycle.vacancy)}</b>
          <span>Vacancies</span>
        </div>
        <div className="f">
          <b>
            {cycle.age_min}&ndash;{cycle.age_max}
          </b>
          <span>Age</span>
        </div>
        {dleft !== null && dleft >= 0 ? (
          <div className="f">
            <b style={{ color: dleft <= 7 ? "var(--red)" : "var(--ink)" }}>{dleft}d</b>
            <span>{dl!.label.includes("Apply") ? "To apply" : "To go"}</span>
          </div>
        ) : (
          <div className="f">
            <b>&mdash;</b>
            <span>Dates soon</span>
          </div>
        )}
      </div>
      <div className="cta">
        <Link className="btn pri sm" href={`/exam/${cycle.id}/`}>
          View Dashboard
        </Link>
        <FollowButton id={cycle.id} />
      </div>
    </div>
  );
}
