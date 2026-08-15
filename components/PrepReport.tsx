import type { PracticeSet } from "@/lib/types";
import type { Locale } from "@/lib/site-config";

export interface Attempt { picked: number | null; seconds: number }

/** Rule-based preparation report: subject/topic analysis, exam-pattern impact
 *  (real negative marking), and test-temperament (psychological) insights. */
export default function PrepReport({ set, attempts, locale }: {
  set: PracticeSet; attempts: Attempt[]; locale: Locale;
}) {
  const hi = locale === "hi";
  const qs = set.questions;
  const n = qs.length;
  const correct = attempts.filter((a, i) => a.picked === qs[i].answer).length;
  const wrong = attempts.filter((a, i) => a.picked !== null && a.picked !== qs[i].answer).length;
  const accuracy = n ? Math.round((correct / n) * 100) : 0;
  const neg = set.negative_mark ?? 0.25;
  const netScore = Math.max(0, +(correct - wrong * neg).toFixed(2));
  const totalSec = attempts.reduce((s, a) => s + a.seconds, 0);
  const avgSec = n ? Math.round(totalSec / n) : 0;

  // Topic breakdown → areas of improvement
  const topicStats = new Map<string, { total: number; right: number }>();
  qs.forEach((q, i) => {
    const t = q.topic ?? set.subject;
    const e = topicStats.get(t) ?? { total: 0, right: 0 };
    e.total++; if (attempts[i].picked === q.answer) e.right++;
    topicStats.set(t, e);
  });
  const topics = Array.from(topicStats.entries())
    .map(([topic, s]) => ({ topic, ...s, pct: Math.round((s.right / s.total) * 100) }))
    .sort((a, z) => a.pct - z.pct);
  const weak = topics.filter((t) => t.pct < 60);
  const strong = topics.filter((t) => t.pct >= 80);

  // Temperament signals (psychology of test-taking)
  const rushedWrong = attempts.filter((a, i) => a.picked !== null && a.picked !== qs[i].answer && a.seconds <= 12).length;
  const slowCorrect = attempts.filter((a, i) => a.picked === qs[i].answer && a.seconds >= 60).length;
  let postErrorDrops = 0;
  attempts.forEach((a, i) => {
    if (i > 0 && attempts[i - 1].picked !== null && attempts[i - 1].picked !== qs[i - 1].answer
        && a.picked !== null && a.picked !== qs[i].answer) postErrorDrops++;
  });

  const mind: string[] = [];
  if (rushedWrong >= 2) mind.push(hi
    ? `जल्दबाज़ी दिख रही है — ${rushedWrong} प्रश्न 12 सेकंड से कम में गलत हुए। उत्तर चुनने से पहले प्रश्न दोबारा पढ़ने की आदत डालें।`
    : `Impulsivity detected — ${rushedWrong} question(s) answered wrong in under 12 seconds. Slow down: re-read the question stem before locking an answer.`);
  if (slowCorrect >= 2) mind.push(hi
    ? `सटीकता अच्छी है पर गति धीमी — ${slowCorrect} सही उत्तरों में 60+ सेकंड लगे। टाइमर के साथ अभ्यास बढ़ाएँ।`
    : `Accuracy is there but speed lags — ${slowCorrect} correct answer(s) took 60+ seconds. Add timed drills to convert accuracy into exam-pace accuracy.`);
  if (postErrorDrops >= 2) mind.push(hi
    ? "एक गलती के बाद अगली गलती की प्रवृत्ति दिखी — गलत उत्तर के बाद 5 सेकंड रुककर साँस लें, फिर अगला प्रश्न नई शुरुआत की तरह लें।"
    : "A wrong answer tends to trigger another — build post-error resilience: pause two breaths after a miss and treat the next question as a fresh start.");
  if (wrong > 0 && neg >= 0.33 && accuracy < 70) mind.push(hi
    ? `इस परीक्षा में ${neg} नेगेटिव मार्किंग है — 50/50 अनुमान महँगे पड़ते हैं। केवल तभी अनुमान लगाएँ जब दो विकल्प हटा सकें।`
    : `This exam deducts ${neg} per wrong answer — coin-flip guessing is costly. Guess only when you can eliminate at least two options.`);
  if (!mind.length) mind.push(hi
    ? "संतुलित प्रदर्शन — गति और सटीकता दोनों नियंत्रण में हैं। अब कठिन स्तर के सेट लें।"
    : "Balanced test temperament — speed and accuracy are both under control. Move up to harder sets to keep growing.");

  const S = ({ children }: { children: React.ReactNode }) =>
    <h3 className="mb-2 mt-5 text-sm font-extrabold uppercase tracking-wide text-slate-500">{children}</h3>;

  return (
    <section className="card p-5" aria-label={hi ? "तैयारी रिपोर्ट" : "Preparation report"}>
      <h2 className="text-xl font-extrabold tracking-tight">📊 {hi ? "आपकी तैयारी रिपोर्ट" : "Your preparation report"}</h2>

      {/* Scoreboard */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [String(correct) + "/" + n, hi ? "सही" : "Correct"],
          [accuracy + "%", hi ? "सटीकता" : "Accuracy"],
          [String(netScore), hi ? `नेट स्कोर (−${neg}/गलत)` : `Net score (−${neg}/wrong)`],
          [avgSec + "s", hi ? "औसत समय/प्रश्न" : "Avg time/question"],
        ].map(([v, l]) => (
          <div key={l as string} className="rounded-xl bg-brand-50 p-3 text-center">
            <b className="block text-xl font-extrabold text-brand-800">{v}</b>
            <span className="text-[11px] font-bold text-slate-500">{l}</span>
          </div>
        ))}
      </div>

      {/* Exam-pattern impact */}
      <S>🎯 {hi ? "परीक्षा-पैटर्न प्रभाव" : "Exam-pattern impact"}</S>
      <p className="text-sm text-slate-600">
        {hi
          ? `वास्तविक परीक्षा की नेगेटिव मार्किंग (−${neg} प्रति गलत) लागू करने पर आपका स्कोर ${correct} से घटकर ${netScore} रह जाता है। ${wrong} गलत उत्तरों की कीमत ${(wrong * neg).toFixed(2)} अंक है।`
          : `Under the real exam's marking scheme (−${neg} per wrong answer), your raw ${correct} becomes a net ${netScore}. Your ${wrong} wrong attempt(s) cost ${(wrong * neg).toFixed(2)} marks — in a close cut-off year that margin decides selection.`}
      </p>

      {/* Topic breakdown */}
      <S>📚 {hi ? "विषय-वार विश्लेषण" : "Subject & topic analysis"}</S>
      <ul className="space-y-2">
        {topics.map((tp) => (
          <li key={tp.topic} className="flex items-center gap-3 text-sm">
            <span className="w-44 flex-none truncate font-bold">{tp.topic}</span>
            <span className="h-2 flex-1 rounded-full bg-slate-100">
              <span className={`block h-2 rounded-full ${tp.pct >= 80 ? "bg-emerald-500" : tp.pct >= 60 ? "bg-accent-500" : "bg-red-500"}`}
                style={{ width: `${Math.max(6, tp.pct)}%` }} />
            </span>
            <span className="w-16 flex-none text-right text-xs font-extrabold">{tp.right}/{tp.total} · {tp.pct}%</span>
          </li>
        ))}
      </ul>

      {/* Areas of improvement */}
      <S>🛠 {hi ? "सुधार के क्षेत्र" : "Areas of improvement"}</S>
      {weak.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          {weak.map((tp) => (
            <li key={tp.topic}><b>{tp.topic}</b> — {hi
              ? `${tp.pct}% सटीकता। मूल अवधारणा दोहराएँ, फिर इसी विषय के 20 प्रश्न लगातार हल करें।`
              : `${tp.pct}% accuracy. Revisit the core concept, then drill 20 questions of this topic back-to-back before your next mock.`}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">{hi ? "कोई कमजोर विषय नहीं — सभी विषयों में 60%+।" : "No weak topics — every topic is at 60%+ accuracy. Raise the bar with a harder set."}</p>
      )}
      {strong.length > 0 && (
        <p className="mt-2 text-sm text-emerald-700">
          💪 {hi ? "मज़बूत विषय:" : "Strengths to bank on:"} {strong.map((t) => t.topic).join(", ")}
        </p>
      )}

      {/* Psychology / temperament */}
      <S>🧠 {hi ? "परीक्षा मनोविज्ञान" : "Test psychology"}</S>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
        {mind.map((m, i) => <li key={i}>{m}</li>)}
      </ul>

      <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
        {hi
          ? "यह रिपोर्ट आपके इसी प्रयास के व्यवहार से बनी है — नियमित मॉक के साथ रुझान और सटीक होते जाएँगे।"
          : "This report is computed from your behaviour in this attempt — patterns get sharper as you take regular mocks. Generated automatically; verify important facts."}
      </p>
    </section>
  );
}
