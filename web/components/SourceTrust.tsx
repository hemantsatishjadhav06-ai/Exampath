import type { Cycle } from "@/lib/types";

export default function SourceTrust({ cycle }: { cycle: Cycle }) {
  const v = cycle.verification;
  if (!v) {
    return (
      <aside className="source-trust source-trust-warn" aria-label="Source verification notice">
        <div>
          <strong>Source verification required</strong>
          <p>This record does not yet have field-level source evidence. Treat dates, vacancies and eligibility as unverified until the official notification is checked.</p>
        </div>
      </aside>
    );
  }

  const verified = v.status === "verified";
  return (
    <aside className={`source-trust ${verified ? "source-trust-ok" : "source-trust-warn"}`} aria-label="Source verification">
      <div className="source-trust-icon" aria-hidden="true">{verified ? "✓" : "!"}</div>
      <div className="source-trust-copy">
        <strong>{verified ? "Official-source verified" : "Partially source-verified"}</strong>
        <p>{v.notes || "Source evidence is attached to this exam record."}</p>
        <div className="source-trust-meta">
          <span>Source: {v.source_name}</span>
          <span>Checked: {v.checked_at}</span>
          <a href={v.source_url} target="_blank" rel="noopener noreferrer">Open official source ↗</a>
        </div>
      </div>
    </aside>
  );
}
