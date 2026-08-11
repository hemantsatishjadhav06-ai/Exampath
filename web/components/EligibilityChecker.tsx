"use client";

import { useState } from "react";
import { QUAL_RANK, type QualCode } from "@/lib/types";

export default function EligibilityChecker({
  exam,
  qualification,
  qualCode,
  ageMin,
  ageMax,
}: {
  exam: string;
  qualification: string;
  qualCode: QualCode;
  ageMin: number;
  ageMax: number;
}) {
  const [age, setAge] = useState("");
  const [qual, setQual] = useState<QualCode>("10th");
  const [res, setRes] = useState<{ ok: boolean; msg: string } | null>(null);

  function check() {
    const a = parseInt(age, 10);
    if (!a) {
      setRes({ ok: false, msg: "Please enter your age." });
      return;
    }
    const ageOk = a >= ageMin && a <= ageMax;
    const qualOk = QUAL_RANK[qual] >= QUAL_RANK[qualCode];
    if (ageOk && qualOk) {
      setRes({
        ok: true,
        msg: `✓ You appear to match the basic age and qualification screen for ${exam}.`,
      });
    } else {
      const reasons: string[] = [];
      if (!ageOk) reasons.push(`the basic age range shown is ${ageMin}–${ageMax}`);
      if (!qualOk) reasons.push(`the minimum qualification shown is ${qualification}`);
      setRes({ ok: false, msg: `✕ Basic screen not matched: ${reasons.join(" · ")}.` });
    }
  }

  return (
    <div className="panel elig">
      <h3>🎯 Basic eligibility check</h3>
      <p className="small muted" style={{ margin: "2px 0 0" }}>
        A quick screening for {exam}, not a final eligibility decision.
      </p>
      <div className="inrow">
        <div>
          <label htmlFor="eAge">Your age</label>
          <input
            type="number"
            id="eAge"
            min="1"
            max="100"
            placeholder="21"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="eQual">Qualification</label>
          <select
            id="eQual"
            value={qual}
            onChange={(e) => setQual(e.target.value as QualCode)}
          >
            <option value="10th">10th pass</option>
            <option value="12th">12th pass</option>
            <option value="graduate">Graduate</option>
            <option value="pg">Post-graduate</option>
          </select>
        </div>
      </div>
      <button id="eligCheck" type="button" className="btn saf sm" onClick={check}>
        Check basic eligibility
      </button>
      {res && <div id="eligRes" className={`res ${res.ok ? "ok" : "no"}`} role="status">{res.msg}</div>}
      <div className="small muted" style={{ marginTop: 8 }}>
        Screening inputs: {qualification} · Age {ageMin}–{ageMax}. Age relaxations and post-specific rules may apply.
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>
        Always confirm the exact post, age cut-off date, category rules, education requirements and physical/medical standards in the official notification.
      </div>
    </div>
  );
}
