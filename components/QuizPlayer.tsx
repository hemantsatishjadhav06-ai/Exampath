"use client";
import { useEffect, useRef, useState } from "react";
import PrepReport, { type Attempt } from "@/components/PrepReport";
import type { PracticeQuestion, PracticeSet } from "@/lib/types";
import type { Locale } from "@/lib/site-config";

/** Fisher–Yates shuffle (non-mutating). */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draw N random questions from the pool and shuffle each question's options
 *  (remapping the answer index) — so every attempt looks different. */
function drawQuestions(set: PracticeSet): PracticeQuestion[] {
  const n = Math.min(set.draw ?? 10, set.questions.length);
  return shuffle(set.questions).slice(0, n).map((q) => {
    const perm = shuffle(q.options.map((_, i) => i));
    return { ...q, options: perm.map((i) => q.options[i]), answer: perm.indexOf(q.answer) };
  });
}

/** Interactive MCQ player: fresh question draw + shuffled options on every
 *  attempt, optional AI-generated sets, per-question timing, and a final
 *  preparation report (topics, exam-pattern impact, test psychology). */
export default function QuizPlayer({ set, locale }: { set: PracticeSet; locale: Locale }) {
  const hi = locale === "hi";
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [i, setI] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());

  function start(qs: PracticeQuestion[]) {
    setQuestions(qs);
    setAttempts(qs.map(() => ({ picked: null, seconds: 0 })));
    setI(0);
    setShowReport(false);
    startedAt.current = Date.now();
  }
  // Draw happens on the client so the shuffle differs per visitor/attempt
  // (server-rendering a shuffle would bake one order into the static HTML).
  useEffect(() => {
    start(drawQuestions(set));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id]);

  async function freshFromAi() {
    // Never silently destroy an attempt in progress.
    const inProgress = attempts.some((a) => a.picked !== null) && !showReport;
    if (inProgress && !window.confirm(hi
      ? "नए प्रश्न लेने से मौजूदा प्रयास मिट जाएगा। जारी रखें?"
      : "Getting new questions will discard your current attempt. Continue?")) return;
    setAiBusy(true); setAiNote(null);
    try {
      const res = await fetch("/api/practice/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: set.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length >= 5) {
        // Shuffle each AI question's options too — LLM output is position-biased.
        const qs: PracticeQuestion[] = (data.questions as PracticeQuestion[]).map((q) => {
          const perm = shuffle(q.options.map((_, k) => k));
          return { ...q, options: perm.map((k) => q.options[k]), answer: perm.indexOf(q.answer) };
        });
        start(qs);
        setAiNote(hi ? "✨ AI ने नए प्रश्न बनाए — तथ्यों की पुष्टि करें।" : "✨ Fresh AI-generated questions — verify important facts.");
      } else throw new Error("bad shape");
    } catch {
      // Keep the current questions/answers untouched on failure.
      setAiNote(hi ? "AI अभी उपलब्ध नहीं — आपका मौजूदा सेट जारी है।" : "AI is unavailable right now — your current set continues unchanged.");
    } finally { setAiBusy(false); }
  }

  if (!questions) {
    return <div className="card p-10 text-center text-sm text-slate-400">{hi ? "प्रश्न तैयार हो रहे हैं…" : "Preparing your questions…"}</div>;
  }
  const n = questions.length;
  const q = questions[i];
  const done = attempts.every((a) => a.picked !== null);
  const score = attempts.filter((a, j) => a.picked === questions[j].answer).length;

  function pick(j: number) {
    if (attempts[i].picked !== null) return;
    const secs = Math.min(300, Math.round((Date.now() - startedAt.current) / 1000));
    const next = [...attempts];
    next[i] = { picked: j, seconds: secs };
    setAttempts(next);
  }
  function go(to: number) { setI(to); startedAt.current = Date.now(); }

  if (showReport) {
    return (
      <div className="flex flex-col gap-4">
        <PrepReport set={{ ...set, questions }} attempts={attempts} locale={locale} />
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => start(drawQuestions(set))} className="btn-ghost">
            🔀 {hi ? "नए प्रश्नों से फिर प्रयास करें" : "Retake with different questions"}
          </button>
          <button onClick={freshFromAi} disabled={aiBusy} className="btn-primary disabled:opacity-50">
            {aiBusy ? (hi ? "बना रहे हैं…" : "Generating…") : "🤖 " + (hi ? "AI से बिल्कुल नए प्रश्न" : "Brand-new AI questions")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
        <span>{hi ? "प्रश्न" : "Question"} {i + 1} / {n} · {q.topic ?? set.subject}</span>
        <span className="flex items-center gap-3">
          <span>{hi ? "स्कोर" : "Score"}: {score}</span>
          <button onClick={freshFromAi} disabled={aiBusy} title={hi ? "AI से नए प्रश्न" : "Fresh AI questions"}
            className="rounded-full border border-slate-200 px-2.5 py-1 font-extrabold text-brand-700 hover:border-brand-300 disabled:opacity-50">
            {aiBusy ? "…" : "🤖 AI"}
          </button>
        </span>
      </div>
      {aiNote && <p className="mb-3 rounded-lg bg-accent-50 px-3 py-2 text-xs font-bold text-accent-700">{aiNote}</p>}
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
