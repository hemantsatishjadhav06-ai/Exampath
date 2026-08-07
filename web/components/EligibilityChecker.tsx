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
        msg: `✓ You're eligible for ${exam}! Age & qualification both match.`,
      });
    } else {
      const reasons: string[] = [];
      if (!ageOk) reasons.push(`age must be ${ageMin}–${ageMax}`);
      if (!qualOk) reasons.push(`needs ${qualification}`);
      setRes({ ok: false, msg: `✕ Not eligible: ${reasons.join(" · ")}.` });
    }
  }

  return (
    <div className="panel elig">
      <h3>🎯 Am I eligible?</h3>
      <p className="small muted" style={{ margin: "2px 0 0" }}>
        Check instantly for {exam}.
      </p>
      <div className="inrow">
        <div>
          <label htmlFor="eAge">Your age</label>
          <input
            type="number"
            id="eAge"
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
      <button type="button" className="btn saf sm" onClick={check}>
        Check eligibility
      </button>
      {res && <div className={`res ${res.ok ? "ok" : "no"}`}>{res.msg}</div>}
      <div className="small muted" style={{ marginTop: 8 }}>
        Needs: {qualification} &middot; Age {ageMin}&ndash;{ageMax} (relaxations apply)
      </div>
    </div>
  );
}
