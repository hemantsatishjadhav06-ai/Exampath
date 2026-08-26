"""Path Finder — turns "who am I?" into "here is exactly what to do".

The site's old model was a catalogue: 23 exams, filter them yourself. This
module inverts it — a student answers 2–3 easy questions (or types one line of
free text) and gets back a *process*: the exams worth their time, ranked and
explained, plus a dated action timeline built from the real notification dates.

Everything is grounded in the published dataset. The rule engine alone always
returns a complete, useful plan (so the page works with no API key and no
network); the LLM only rewrites the human summary on top of those same facts.
"""
from __future__ import annotations
from datetime import date

from ..llm.openrouter import OpenRouterClient, OpenRouterError
from .assistant import QUAL_RANK, _days_left, _next_deadline, facts_block, parse_query

# What a student says they want -> the conducting bodies that deliver it.
INTERESTS: dict[str, dict] = {
    "banking":         {"label": "Bank jobs",            "bodies": ["ibps", "sbi", "rbi"]},
    "ssc":             {"label": "SSC / clerical",       "bodies": ["ssc"]},
    "railway":         {"label": "Railways",             "bodies": ["rrb"]},
    "teaching":        {"label": "Teaching / lecturer",  "bodies": ["cbse", "nta"]},
    "civil-services":  {"label": "Civil services (IAS/PCS)", "bodies": ["upsc", "bpsc", "mppsc", "rpsc", "uppsc"]},
    "defence-police":  {"label": "Defence & police",     "bodies": ["upsc", "ssc"],
                        "ids": ["nda-2026", "cds-2026", "ssc-gd-2026"]},
    "state":           {"label": "State government jobs", "bodies": ["bpsc", "mppsc", "rpsc", "uppsc"]},
}

# Status -> what the student actually has to DO about it.
ACTION = {
    "closing_soon":     ("Apply now",           "apply"),
    "application_open": ("Apply",               "apply"),
    "admit_card":       ("Download admit card", "admit"),
    "result_awaited":   ("Check result",        "result"),
    "upcoming":         ("Get ready",           "prepare"),
}

# Bucket a date into a plain-language horizon.
BUCKETS = [(7, "This week"), (30, "This month"), (90, "Next 3 months")]


def _bucket(days: int | None) -> str:
    if days is None:
        return "Later"
    for limit, label in BUCKETS:
        if days <= limit:
            return label
    return "Later"


def normalise(profile: dict) -> dict:
    """Merge explicit answers with anything parsed out of free text."""
    p = dict(profile or {})
    parsed = parse_query(p.get("query") or "")
    education = (p.get("education") or parsed.get("qualification") or "").strip() or None
    age = p.get("age")
    try:
        age = int(age) if age not in (None, "") else parsed.get("age")
    except (TypeError, ValueError):
        age = parsed.get("age")
    interest = (p.get("interest") or "").strip() or None
    if not interest and parsed.get("body"):
        for key, cfg in INTERESTS.items():
            if parsed["body"] in cfg["bodies"]:
                interest = key
                break
    return {
        "education": education if education in QUAL_RANK else None,
        "age": age if isinstance(age, int) and 10 <= age <= 70 else None,
        "state": (p.get("state") or "").strip().lower() or None,
        "interest": interest if interest in INTERESTS else None,
        "query": (p.get("query") or "").strip() or None,
    }


def _eligible(cycle: dict, prof: dict) -> tuple[bool, str | None]:
    """Eligibility is a hard gate — never recommend an exam a student cannot sit."""
    if prof["education"]:
        need = QUAL_RANK.get(cycle.get("qualification_code") or "", 0)
        if QUAL_RANK[prof["education"]] < need:
            return False, f"needs {cycle.get('qualification', 'a higher qualification')}"
    if prof["age"] is not None:
        lo, hi = cycle.get("age_min"), cycle.get("age_max")
        if lo is not None and hi is not None and not (lo <= prof["age"] <= hi):
            return False, f"age limit {lo}–{hi}"
    return True, None


def score_cycles(dataset: dict, prof: dict) -> list[dict]:
    """Rank eligible exams by fit (interest, state) and urgency (deadline)."""
    bodies = {b["slug"]: b for b in dataset.get("bodies", [])}
    wanted = INTERESTS.get(prof["interest"] or "", {})
    wanted_bodies = set(wanted.get("bodies", []))
    wanted_ids = set(wanted.get("ids", []))
    out = []
    for c in dataset.get("cycles", []):
        ok, blocker = _eligible(c, prof)
        if not ok:
            continue
        body = bodies.get(c.get("body"), {})
        score, why = 0, []
        if wanted_bodies or wanted_ids:
            if c["id"] in wanted_ids or c.get("body") in wanted_bodies:
                score += 40
                why.append(f"matches your interest in {wanted.get('label', 'this field').lower()}")
            else:
                score -= 15
        if prof["state"] and prof["state"] in (body.get("level") or "").lower():
            score += 25
            why.append("run by your state government")
        nd = _next_deadline(c)
        days = _days_left(nd["date"]) if nd else None
        if c.get("status") == "closing_soon":
            score += 30
        elif c.get("status") == "application_open":
            score += 20
        elif c.get("status") == "admit_card":
            score += 10
        if days is not None:
            score += max(0, 30 - days) // 3
            why.append(f"{nd['label'].lower()} in {days} days")
        if c.get("vacancy"):
            score += min(10, int(c["vacancy"]) // 2000)
            why.append(f"{int(c['vacancy']):,} vacancies")
        if prof["education"]:
            why.append(f"open to {c.get('qualification', prof['education'])}")
        label, kind = ACTION.get(c.get("status") or "", ("Get ready", "prepare"))
        out.append({
            "id": c["id"], "title": c["title"], "body": (c.get("body") or "").upper(),
            "status": c.get("status"), "action": label, "action_kind": kind,
            "vacancy": c.get("vacancy"), "qualification": c.get("qualification"),
            "deadline": (nd or {}).get("date"), "deadline_label": (nd or {}).get("label"),
            "days_left": days, "when": _bucket(days),
            "why": "; ".join(why[:3]) or "matches your profile",
            "score": score,
        })
    out.sort(key=lambda x: (-x["score"], x["days_left"] if x["days_left"] is not None else 999))
    return out


def build_steps(matches: list[dict]) -> list[dict]:
    """Turn the shortlist into a dated do-this-next timeline."""
    order = {"This week": 0, "This month": 1, "Next 3 months": 2, "Later": 3}
    groups: dict[str, list[dict]] = {}
    for m in matches[:8]:
        groups.setdefault(m["when"], []).append(m)
    steps = []
    for when in sorted(groups, key=lambda w: order.get(w, 9)):
        items = groups[when]
        steps.append({
            "when": when,
            "title": {
                "apply":   "Apply before the form closes",
                "admit":   "Download your admit card",
                "result":  "Check your result",
                "prepare": "Start preparing",
            }.get(items[0]["action_kind"], "Take the next step"),
            "items": [{
                "id": i["id"], "title": i["title"], "action": i["action"],
                "detail": (f"{i['deadline_label']} {i['deadline']} "
                           f"({i['days_left']} days left)") if i["deadline"] else "dates to be announced",
            } for i in items],
        })
    return steps


def plan_path(dataset: dict, profile: dict, client: OpenRouterClient | None = None) -> dict:
    """The whole process for one student: shortlist + timeline + summary."""
    prof = normalise(profile)
    matches = score_cycles(dataset, prof)
    steps = build_steps(matches)
    summary = _fallback_summary(prof, matches)
    used_llm = False

    client = client or OpenRouterClient()
    if client.available and matches:
        cycles_by_id = {c["id"]: c for c in dataset.get("cycles", [])}
        facts = facts_block([cycles_by_id[m["id"]] for m in matches[:6] if m["id"] in cycles_by_id])
        who = ", ".join(filter(None, [
            prof["education"] and f"{prof['education']} pass",
            prof["age"] and f"age {prof['age']}",
            prof["interest"] and INTERESTS[prof["interest"]]["label"],
            prof["query"],
        ])) or "a student exploring government jobs"
        try:
            summary = client.chat([
                {"role": "system", "content":
                    "You are ExamPath's career guide for Indian government exams. Use ONLY the given "
                    "facts — never invent dates, fees or vacancies. Write 3–4 short sentences in plain, "
                    "encouraging English for a first-time aspirant: which exam to focus on first and why, "
                    "and what to do this week. End by telling them to confirm on the official website."},
                {"role": "user", "content": f"Student: {who}\n\nEligible exams (already filtered for them):\n{facts}"},
            ], max_tokens=400).strip() or summary
            used_llm = True
        except OpenRouterError:
            pass

    return {
        "ok": True, "profile": prof, "summary": summary,
        "matches": matches[:12], "steps": steps,
        "total_eligible": len(matches), "used_llm": used_llm,
        "generated_at": date.today().isoformat(),
    }


def _fallback_summary(prof: dict, matches: list[dict]) -> str:
    if not matches:
        return ("No exam in our current data matches that profile. Try widening it — clear the age or "
                "interest filter, or pick a different field — and always confirm on the official website.")
    top = matches[0]
    bits = []
    if prof["education"]:
        bits.append(f"{prof['education']} pass")
    if prof["age"]:
        bits.append(f"age {prof['age']}")
    who = " and ".join(bits) if bits else "your profile"
    urgent = [m for m in matches if m["days_left"] is not None and m["days_left"] <= 30]
    lead = f"For {who}, {len(matches)} exam(s) are open to you right now. "
    focus = f"Start with {top['title']} — {top['why']}. "
    act = (f"{len(urgent)} of them close within a month, so apply to "
           f"{urgent[0]['title']} first ({urgent[0]['days_left']} days left). ") if urgent else \
          "None of them close this month, so use the time to prepare. "
    return lead + focus + act + "Always confirm details on the official website before applying."
