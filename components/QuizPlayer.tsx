"use client";
import { useRef, useState } from "react";
import PrepReport, { type Attempt } from "@/components/PrepReport";
import type { PracticeSet } from "@/lib/types";
import type { Locale } from "@/lib/site-config";

/** Interactive MCQ player: instant feedback + per-question timing, ending in a
 *  full preparation report (topics, exam-pattern impact, test psychology). */
export default function QuizPlayer({ set, locale }: { set: PracticeSet; locale: Locale }) {
  const hi = locale === "hi";
  const n = set.questions.length;
  const [i, setI] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>(
    Array.from({ length: n }, () => ({ picked: null, seconds: 0 }))
  );
  const [showReport, setShowReport] = useState(false);
  const startedAt = useRef<number>(Date.now());

  const q = set.questions[i];
  const done = attempts.every((a) => a.picked !== null);
  const score = attempts.filter((a, j) => a.picked === set.questions[j].answer).length;

  function pick(j: number) {
    if (attempts[i].picked !== null) return;
    const secs = Math.min(300, Math.round((Date.now() - startedAt.current) / 1000));
    const next = [...attempts];
    next[i] = { picked: j, seconds: secs };
    setAttempts(next);
  }
  function go(to: number) {
    setI(to);
    startedAt.current = Date.now();
  }

  if (showReport) {
    return (
      <div className="flex flex-col gap-4">
        <PrepReport set={set} attempts={attempts} locale={locale} />
        <button onClick={() => { setAttempts(Array.from({ length: n }, () => ({ picked: null, seconds: 0 }))); setShowReport(false); go(0); }}
          className="btn-ghost self-center">↺ {hi ? "फिर से प्रयास करें" : "Retake the test"}</button>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-500">
        <span>{hi ? "प्रश्न" : "Question"} {i + 1} / {n} · {q.topic ?? set.subject}</span>
        <span>{hi ? "स्कोर" : "Score"}: {score}</span>
      </div>
      <h2 className="text-[15.5px] font-extrabold leading-snug">{q.q}</h2>
      <div className="mt-4 flex flex-col gap-2">
        {q.options.map((opt, j) => {
          const chosen = attempts[i].picked === j;
          const answered = attempts[i].picked !== null;
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
      {attempts[i].picked !== null && (
        <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-slate-700">
          <b>{attempts[i].picked === q.answer ? "✓ " + (hi ? "सही!" : "Correct!") : "✕ " + (hi ? "सही उत्तर" : "Correct answer") + ": " + String.fromCharCode(65 + q.answer)}</b> — {q.why}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between">
        <button onClick={() => go(Math.max(0, i - 1))} disabled={i === 0} className="btn-ghost disabled:opacity-40">← {hi ? "पिछला" : "Previous"}</button>
        {done
          ? <button onClick={() => setShowReport(true)} className="btn-accent">📊 {hi ? "रिपोर्ट देखें" : "View my report"}</button>
          : <button onClick={() => go(Math.min(n - 1, i + 1))} disabled={i === n - 1} className="btn-primary disabled:opacity-40">{hi ? "अगला" : "Next"} →</button>}
      </div>
    </div>
  );
}
