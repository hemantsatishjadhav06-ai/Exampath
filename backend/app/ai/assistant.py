"""ExamPath AI assistant — the standout backend feature.

Two capabilities, both grounded ONLY in the platform's own canonical data
(retrieval-augmented, so answers can't drift into hallucination):

  answer_question(question, dataset)  -> natural-language Q&A over exams
  personal_digest(dataset, profile)   -> personalised "what's urgent for me" list

The LLM is OpenRouter (see app/llm/openrouter.py). If no key is configured, both
functions fall back to deterministic, still-useful output — so the API always works.
"""
from __future__ import annotations
import re
from datetime import date

from ..llm.openrouter import OpenRouterClient, OpenRouterError

QUAL_RANK = {"10th": 1, "12th": 2, "graduate": 3, "pg": 4}


# ----------------------------------------------------------------------------- parsing
def parse_query(q: str) -> dict:
    """Extract structured filters from a free-text question."""
    ql = (q or "").lower()
    age = None
    m = re.search(r"\bage\s*(\d{2})\b", ql) or re.search(r"\b(1[89]|[23]\d)\s*(?:years|yrs|year)?\b", ql)
    if m:
        age = int(m.group(1))
    qual = None
    if re.search(r"graduat|degree|b\.?a|b\.?sc|b\.?com|b\.?tech|bachelor", ql):
        qual = "graduate"
    elif re.search(r"12th|inter|higher second", ql):
        qual = "12th"
    elif re.search(r"10th|matric", ql):
        qual = "10th"
    elif re.search(r"post.?grad|master|m\.?a|m\.?sc", ql):
        qual = "pg"
    body = None
    for b in ("ssc", "upsc", "ibps", "rrb", "mppsc"):
        if b in ql:
            body = b
    if re.search(r"\bbank", ql):
        body = "ibps"
    if re.search(r"rail|train", ql):
        body = "rrb"
    closing = bool(re.search(r"clos|soon|deadline|last date|urgent", ql))
    return {"age": age, "qualification": qual, "body": body, "closing_soon": closing}


def _days_left(iso: str | None):
    if not iso:
        return None
    try:
        return (date.fromisoformat(iso) - date.today()).days
    except Exception:
        return None


def _next_deadline(cycle: dict):
    ds = [d for d in cycle.get("dates", []) if d.get("is_deadline") and _days_left(d.get("date")) is not None and _days_left(d["date"]) >= 0]
    ds.sort(key=lambda d: d["date"])
    return ds[0] if ds else None


def filter_cycles(dataset: dict, f: dict) -> list[dict]:
    out = []
    for c in dataset.get("cycles", []):
        if f.get("body") and c.get("body") != f["body"]:
            continue
        if f.get("qualification") and c.get("qualification_code") != f["qualification"]:
            continue
        if f.get("age") is not None and not (c.get("age_min", 0) <= f["age"] <= c.get("age_max", 200)):
            continue
        if f.get("closing_soon"):
            nd = _next_deadline(c)
            if not nd or (_days_left(nd["date"]) or 999) > 30:
                continue
        out.append(c)
    return out


# ----------------------------------------------------------------------------- grounding
def facts_block(cycles: list[dict], limit: int = 8) -> str:
    lines = []
    for c in cycles[:limit]:
        nd = _next_deadline(c)
        dl = f"{nd['label']} {nd['date']} ({_days_left(nd['date'])} days left)" if nd else "dates to be announced"
        fee = ""
        if c.get("fees"):
            fee = " | fee: " + ", ".join(f"{x['category']} ₹{x['amount']}" for x in c["fees"][:3])
        lines.append(
            f"- {c['title']} ({c['body'].upper()}): {c.get('qualification','')}, age {c.get('age_min')}–{c.get('age_max')}, "
            f"{c.get('vacancy','?')} vacancies, status {c.get('status')}, next: {dl}.{fee} {c.get('summary','')}"
        )
    return "\n".join(lines) if lines else "(no matching exams found in the database)"


# ----------------------------------------------------------------------------- Q&A
def answer_question(question: str, dataset: dict, client: OpenRouterClient | None = None) -> dict:
    f = parse_query(question)
    matches = filter_cycles(dataset, f)
    if not matches and not any(f.values()):
        matches = dataset.get("cycles", [])
    client = client or OpenRouterClient()
    ctx = facts_block(matches)

    if client.available:
        try:
            msg = [
                {"role": "system", "content":
                    "You are ExamPath's assistant for Indian government exams. Answer ONLY using the "
                    "provided facts — never invent dates, fees or vacancies. Be concise and mobile-friendly "
                    "(3–5 sentences). Always tell the user to confirm on the official website before acting."},
                {"role": "user", "content":
                    f"Question: {question}\n\nFacts from our database:\n{ctx}\n\n"
                    "Answer the question, then list the matching exams by name."},
            ]
            answer = client.chat(msg, max_tokens=450).strip()
            return {"answer": answer, "matches": [c["id"] for c in matches], "used_llm": True, "filters": f}
        except OpenRouterError:
            pass  # fall through to deterministic answer

    return {"answer": _fallback_answer(matches, f), "matches": [c["id"] for c in matches],
            "used_llm": False, "filters": f}


def _fallback_answer(matches: list[dict], f: dict) -> str:
    if not matches:
        return ("I couldn't find a matching exam in the current data. Try naming a body (SSC, UPSC, "
                "IBPS, RRB) or your qualification (10th / 12th / graduate).")
    bits = []
    if f.get("qualification"):
        bits.append(f.get("qualification"))
    if f.get("age") is not None:
        bits.append(f"age {f['age']}")
    if f.get("body"):
        bits.append(f["body"].upper())
    lead = ("Based on " + ", ".join(bits) + ", " if bits else "") + f"you have {len(matches)} matching exam(s): "
    names = []
    for c in matches[:6]:
        nd = _next_deadline(c)
        tail = f" — {nd['label']} in {_days_left(nd['date'])} days" if nd else " — dates to be announced"
        names.append(f"{c['title']} ({c.get('vacancy','?')} posts){tail}")
    return lead + "; ".join(names) + ". Always confirm on the official website before applying."


# ----------------------------------------------------------------------------- personalised digest
def personal_digest(dataset: dict, profile: dict, client: OpenRouterClient | None = None) -> dict:
    """profile = {age?, qualification?, category?, following?:[cycle_id]}. Returns urgency-sorted items."""
    age = profile.get("age")
    qual = profile.get("qualification")
    following = set(profile.get("following") or [])
    items = []
    for c in dataset.get("cycles", []):
        eligible = True
        if age is not None and not (c.get("age_min", 0) <= age <= c.get("age_max", 200)):
            eligible = False
        if qual and QUAL_RANK.get(qual, 0) < QUAL_RANK.get(c.get("qualification_code", ""), 0):
            eligible = False
        if not (eligible or c["id"] in following):
            continue
        nd = _next_deadline(c)
        if not nd:
            continue
        items.append({
            "id": c["id"], "title": c["title"], "label": nd["label"],
            "date": nd["date"], "days_left": _days_left(nd["date"]),
            "followed": c["id"] in following, "eligible": eligible,
        })
    items.sort(key=lambda x: x["days_left"])
    summary = None
    client = client or OpenRouterClient()
    if client.available and items:
        try:
            lines = "\n".join(f"- {i['title']}: {i['label']} in {i['days_left']} days" for i in items[:8])
            summary = client.chat([
                {"role": "system", "content": "You write a short, motivating 2-sentence deadline reminder for an Indian exam aspirant."},
                {"role": "user", "content": f"My upcoming deadlines:\n{lines}\nWrite a 2-sentence nudge."},
            ], max_tokens=120).strip()
        except OpenRouterError:
            summary = None
    if summary is None and items:
        soon = items[0]
        summary = f"You have {len(items)} upcoming deadline(s). Most urgent: {soon['title']} — {soon['label']} in {soon['days_left']} days."
    return {"summary": summary, "items": items, "used_llm": bool(summary) and client.available}
