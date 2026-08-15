import { NextRequest, NextResponse } from "next/server";
import { getPracticeSet } from "@/lib/queries";
import type { PracticeQuestion } from "@/lib/types";

export const maxDuration = 60;

// Simple in-memory throttle (single-instance deploy): per-IP and global caps
// so the paid LLM endpoint cannot be drained by a curl loop.
const WINDOW_MS = 10 * 60_000;
const PER_IP_MAX = 5;
const GLOBAL_MAX = 60;
const ipHits = new Map<string, number[]>();
let globalHits: number[] = [];
function allow(ip: string): boolean {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  if (globalHits.length >= GLOBAL_MAX) return false;
  const mine = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (mine.length >= PER_IP_MAX) return false;
  mine.push(now); ipHits.set(ip, mine); globalHits.push(now);
  if (ipHits.size > 5000) ipHits.clear(); // bound memory
  return true;
}

/** Generate a fresh 10-question MCQ set for a practice topic via OpenRouter.
 *  Output is strictly validated; on any failure the client falls back to the
 *  built-in shuffled pool, so this endpoint can never break the quiz. */
export async function POST(req: NextRequest) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: "no_provider" }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });

  const body = (await req.json().catch(() => null)) ?? {};
  const { setId } = body as { setId?: number };
  const set = await getPracticeSet(Number(setId));
  if (!set) return NextResponse.json({ ok: false }, { status: 400 });

  const topics = Array.from(new Set(set.questions.map((q) => q.topic).filter(Boolean))).join(", ");
  const prompt = `Create 10 original multiple-choice questions for the Indian government exam "${set.title}" (subject: ${set.subject}; topics to draw from: ${topics}).
Rules: exam-realistic difficulty; exactly 4 options each; one correct answer; factual accuracy is critical — prefer maths/logic/stable facts over recent events; vary topics.
Return ONLY a JSON array, each item: {"q": string, "options": [string,string,string,string], "answer": <0-3 index of the correct option>, "why": <one-line explanation>, "topic": string}.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "You write rigorous, factually correct exam MCQs. Output pure JSON only — no markdown fences, no commentary." },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 2400,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const jsonText = raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
    const parsed = JSON.parse(jsonText);

    const questions: PracticeQuestion[] = (Array.isArray(parsed) ? parsed : [])
      .filter((x: unknown): x is PracticeQuestion => {
        const q = x as PracticeQuestion;
        return typeof q?.q === "string" && q.q.length > 8 &&
          Array.isArray(q.options) && q.options.length === 4 &&
          q.options.every((o) => typeof o === "string" && o.length > 0) &&
          Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3 &&
          typeof q.why === "string" &&
          (q.topic === undefined || typeof q.topic === "string");
      })
      .slice(0, 10)
      .map((q) => ({ q: q.q, options: q.options, answer: q.answer, why: q.why, topic: q.topic || set.subject }));

    if (questions.length < 5) throw new Error("too few valid questions");
    return NextResponse.json({ ok: true, questions, source: "ai" });
  } catch {
    return NextResponse.json({ ok: false, reason: "generation_failed" }, { status: 502 });
  }
}
