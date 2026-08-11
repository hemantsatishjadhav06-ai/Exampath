import type { CSSProperties } from "react";
import type { Cycle } from "@/lib/types";

const box: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "14px 16px",
  margin: "16px 0",
  border: "1px solid var(--line)",
  borderRadius: 14,
  background: "#fff",
};

export default function SourceTrust({ cycle }: { cycle: Cycle }) {
  const v = cycle.verification;
  if (!v) {
    return (
      <aside style={{ ...box, borderColor: "#f0d9a6", background: "#fffaf0" }} aria-label="Source verification notice">
        <div aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--amber-soft)", color: "var(--amber)", fontWeight: 900 }}>!</div>
        <div>
          <strong>Source verification required</strong>
          <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 13 }}>This record does not yet have field-level source evidence. Treat dates, vacancies and eligibility as unverified until the official notification is checked.</p>
        </div>
      </aside>
    );
  }

  const verified = v.status === "verified";
  return (
    <aside style={{ ...box, borderColor: verified ? "#b9e5d1" : "#f0d9a6", background: verified ? "#f6fffa" : "#fffaf0" }} aria-label="Source verification">
      <div aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: verified ? "var(--green-soft)" : "var(--amber-soft)", color: verified ? "var(--green)" : "var(--amber)", fontWeight: 900 }}>{verified ? "✓" : "!"}</div>
      <div style={{ minWidth: 0 }}>
        <strong>{verified ? "Official-source verified" : "Partially source-verified"}</strong>
        <p style={{ margin: "3px 0 6px", color: "var(--muted)", fontSize: 13 }}>{v.notes || "Source evidence is attached to this exam record."}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
          <span>Source: {v.source_name}</span>
          <span>Checked: {v.checked_at}</span>
          <a href={v.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", fontWeight: 700 }}>Open official source ↗</a>
        </div>
      </div>
    </aside>
  );
}
