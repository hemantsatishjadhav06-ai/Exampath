"""The self-updating guidance agent.

Runs at the end of every pipeline run (daily, in CI). It re-reads the freshly
published dataset and, without inventing a single fact, does three jobs:

  1. Reconciles each cycle's *status* against its own dates. Curated statuses
     go stale silently — a cycle marked "closing soon" whose last date passed
     three weeks ago is worse than no label at all. The agent recomputes the
     status from the dates we actually hold and flags anything whose dates are
     all in the past as `needs_refresh`, so the scrapers (and humans) know
     exactly where to look.
  2. Writes a per-cycle `ai_next` block — the single next action a student
     should take for that exam, in plain words, with the days left.
  3. Writes a site-wide `ai_briefing` — today's headline, the urgent few, and
     how much of the dataset needs a fresh official notification.

The static site renders these fields directly, so every page carries current,
agent-written guidance with zero runtime AI cost.
"""
from __future__ import annotations
from datetime import date

CLOSING_WINDOW = 15      # days before a deadline that counts as "closing soon"
ADMIT_WINDOW = 30        # days before an exam that admit cards usually appear


def _d(iso: str | None) -> date | None:
    try:
        return date.fromisoformat(iso) if iso else None
    except (TypeError, ValueError):
        return None


def _pick(cycle: dict, *needles: str, deadline_only: bool = False) -> tuple[date | None, str | None]:
    """Earliest date whose label mentions any needle."""
    best: tuple[date, str] | None = None
    for row in cycle.get("dates", []):
        if deadline_only and not row.get("is_deadline"):
            continue
        label = (row.get("label") or "").lower()
        if needles and not any(n in label for n in needles):
            continue
        dt = _d(row.get("date"))
        if dt and (best is None or dt < best[0]):
            best = (dt, row.get("label"))
    return best if best else (None, None)


def reconcile_status(cycle: dict, today: date) -> dict:
    """Derive the true status from the cycle's own dates. Never invents dates."""
    apply_by, apply_label = _pick(cycle, deadline_only=True)
    exam_on, exam_label = _pick(cycle, "exam", "tier", "prelim", "paper")
    admit_on, _ = _pick(cycle, "admit", "hall ticket")
    result_on, _ = _pick(cycle, "result", "answer key")

    if apply_by and apply_by >= today:
        left = (apply_by - today).days
        status = "closing_soon" if left <= CLOSING_WINDOW else "application_open"
        return {"status": status, "action": "apply", "date": apply_by.isoformat(),
                "label": apply_label or "Last date to apply", "days_left": left, "needs_refresh": False}
    if admit_on and admit_on >= today:
        return {"status": "admit_card", "action": "admit", "date": admit_on.isoformat(),
                "label": "Admit card", "days_left": (admit_on - today).days, "needs_refresh": False}
    if exam_on and exam_on >= today:
        left = (exam_on - today).days
        status = "admit_card" if left <= ADMIT_WINDOW else "upcoming"
        return {"status": status, "action": "prepare", "date": exam_on.isoformat(),
                "label": exam_label or "Exam date", "days_left": left, "needs_refresh": False}
    if result_on and result_on >= today:
        return {"status": "result_awaited", "action": "result", "date": result_on.isoformat(),
                "label": "Result", "days_left": (result_on - today).days, "needs_refresh": False}
    # Everything we hold is in the past: the cycle needs a fresh official notice.
    return {"status": "result_awaited" if (exam_on or apply_by) else "upcoming",
            "action": "watch", "date": None, "label": None, "days_left": None, "needs_refresh": True}


NEXT_TEXT = {
    "apply":   ("Apply online now", "Fill the official form before {label} on {date} — {days} days left."),
    "admit":   ("Download your admit card", "{label} {date} — {days} days away. Carry a photo ID."),
    "prepare": ("Start focused preparation", "{label} {date} — {days} days to go. Work backwards from that date."),
    "result":  ("Watch for the result", "{label} expected {date}."),
    "watch":   ("Waiting for the next official notification",
                "Our latest verified dates for this cycle have passed. We re-check the official site daily."),
}


def run_agent(dataset: dict, today: date | None = None) -> dict:
    """Annotate the dataset in place; return a report of what changed."""
    today = today or date.today()
    corrections, stale, urgent = [], [], []

    for c in dataset.get("cycles", []):
        r = reconcile_status(c, today)
        before = c.get("status")
        if before != r["status"]:
            corrections.append({"id": c["id"], "from": before, "to": r["status"]})
            c["status"] = r["status"]
            c["status_source"] = "agent"
        headline, detail = NEXT_TEXT[r["action"]]
        c["ai_next"] = {
            "action": r["action"], "headline": headline,
            "detail": detail.format(label=r["label"] or "", date=r["date"] or "",
                                    days=r["days_left"] if r["days_left"] is not None else ""),
            "days_left": r["days_left"], "needs_refresh": r["needs_refresh"],
            "checked_on": today.isoformat(),
        }
        if r["needs_refresh"]:
            stale.append(c["id"])
        elif r["days_left"] is not None and r["days_left"] <= 30 and r["action"] in ("apply", "admit"):
            urgent.append({"id": c["id"], "title": c["title"], "action": r["action"],
                           "days_left": r["days_left"], "date": r["date"]})

    urgent.sort(key=lambda x: x["days_left"])
    total = len(dataset.get("cycles", []))
    if urgent:
        head = (f"{len(urgent)} exam{'s' if len(urgent) != 1 else ''} need action within 30 days — "
                f"{urgent[0]['title']} is first, in {urgent[0]['days_left']} days.")
    elif stale and total and len(stale) == total:
        head = ("No open application windows in our verified data right now — every cycle is between "
                "notifications. We re-check the official sites every day.")
    else:
        head = f"{total - len(stale)} exam cycle(s) tracked with live dates; nothing closes in the next 30 days."

    dataset["ai_briefing"] = {
        "generated_at": today.isoformat(), "headline": head,
        "urgent": urgent[:5], "needs_refresh": stale,
        "tracked": total, "corrected": len(corrections),
    }
    return {"corrections": corrections, "stale": stale, "urgent": urgent}
