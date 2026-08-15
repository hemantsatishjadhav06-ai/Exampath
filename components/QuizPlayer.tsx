"use client";
import { useState } from "react";
import type { PracticeSet } from "@/lib/types";
import type { Locale } from "@/lib/site-config";

/** Interactive MCQ player: answer -> instant feedback + explanation -> score. */
export default function QuizPlayer({ set, locale }: { set: PracticeSet; locale: Locale }) {
  const hi = locale === "hi";
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(Array(set.questions.length).fill(null));
  const q = set.questions[i];
  const done = picked.every((p) => p !== null);
  const score = picked.filter((p, j) => p === set.questions[j].answer).length;

  function pick(j: number) {
    if (picked[i] !== null) return;
    const next = [...picked]; next[i] = j; setPicked(next);
  }
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-500">
        <span>{hi ? "प्रश्न" : "Question"} {i + 1} / {set.questions.length}</span>
        <span>{hi ? "स्कोर" : "Score"}: {score}</span>
      </div>
      <h2 className="text-[15.5px] font-extrabold leading-snug">{q.q}</h2>
      <div className="mt-4 flex flex-col gap-2">
        {q.options.map((opt, j) => {
          const chosen = picked[i] === j;
          const answered = picked[i] !== null;
          const correct = j === q.answer;
          const cls = answered
            ? correct ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : chosen ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 text-slate-500"
            : "border-slate-200 bg-white hover:border-brand-300";
          return (
            <button key={j} onClick={() => pick(j)} disabled={answered}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${cls}`}>
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full border border-current text-xs font-extrabold">
                {String.fromCharCode(65 + j)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
      {picked[i] !== null && (
        <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-slate-700">
          <b>{picked[i] === q.answer ? "✓ " + (hi ? "सही!" : "Correct!") : "✕ " + (hi ? "सही उत्तर" : "Correct answer") + ": " + String.fromCharCode(65 + q.answer)}</b> — {q.why}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between">
        <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="btn-ghost disabled:opacity-40">← {hi ? "पिछला" : "Previous"}</button>
        {done && i === set.questions.length - 1
          ? <span className="text-sm font-extrabold text-brand-700">{hi ? "पूर्ण!" : "Done!"} {score}/{set.questions.length}</span>
          : <button onClick={() => setI(Math.min(set.questions.length - 1, i + 1))} disabled={i === set.questions.length - 1} className="btn-primary disabled:opacity-40">{hi ? "अगला" : "Next"} →</button>}
      </div>
    </div>
  );
}
