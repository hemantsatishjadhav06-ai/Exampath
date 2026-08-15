"""AI/rule-based extraction: turn a scraped notice (HTML) into structured fields.

This reference implementation uses BeautifulSoup + regex against the notice markup.
For messy real-world PDFs/HTML, swap `extract_from_html` for an LLM structured-output
call (see `LLMExtractor` stub) — the rest of the pipeline is unchanged.
"""
from __future__ import annotations
import re

from bs4 import BeautifulSoup


def _to_int(text: str | None):
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def extract_from_html(html: str, hint: str = "generic") -> dict:
    """Extract core cycle fields + a confidence score from a notice page."""
    soup = BeautifulSoup(html, "lxml")

    def field(name: str):
        el = soup.select_one(f'[data-field="{name}"]')
        return el.get_text(strip=True) if el else None

    title = field("title")
    vacancy = _to_int(field("vacancy"))
    qualification = field("qualification")

    age_txt = field("age") or ""
    m = re.search(r"(\d{2})\s*(?:[-–]|to)\s*(\d{2})", age_txt)
    age_min = int(m.group(1)) if m else None
    age_max = int(m.group(2)) if m else None

    dates = []
    for row in soup.select('[data-field="date"]'):
        label = row.get("data-label") or row.get_text(strip=True)
        value = row.get("data-value") or ""
        if value:
            dates.append({
                "label": label,
                "date": value,
                "is_deadline": row.get("data-deadline") == "true",
            })

    present = sum(x is not None for x in [title, vacancy, qualification, age_min])
    confidence = round(min(0.5 + 0.1 * present + (0.1 if dates else 0.0), 0.99), 2)

    return {
        "title": title,
        "vacancy": vacancy,
        "qualification": qualification,
        "age_min": age_min,
        "age_max": age_max,
        "dates": dates,
        "confidence": confidence,
        "hint": hint,
    }


_MONTHS = {
    m: i + 1 for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun",
         "jul", "aug", "sep", "oct", "nov", "dec"])
}


def _parse_date(text: str) -> str | None:
    """Best-effort parse of the FIRST date in `text` to ISO YYYY-MM-DD.

    Candidates from every supported format are collected with their position;
    the earliest one wins, so "…apply 19/08/2026 … exam 2026-11-05" yields the
    19 Aug value rather than whichever format is tried first.
    """
    t = text.strip()
    cands: list[tuple[int, str]] = []

    for m in re.finditer(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b", t):  # 2026-03-01
        y, mo, d = map(int, m.groups())
        if 1 <= mo <= 12 and 1 <= d <= 31:
            cands.append((m.start(), f"{y:04d}-{mo:02d}-{d:02d}"))

    for m in re.finditer(r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b", t):  # 01/03/2026
        d, mo, y = map(int, m.groups())
        if 1 <= mo <= 12 and 1 <= d <= 31:
            cands.append((m.start(), f"{y:04d}-{mo:02d}-{d:02d}"))

    for m in re.finditer(r"\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})\b", t):  # 1 March 2026
        mon = _MONTHS.get(m.group(2)[:3].lower())
        if mon:
            d, y = int(m.group(1)), int(m.group(3))
            if 1 <= d <= 31:
                cands.append((m.start(), f"{y:04d}-{mon:02d}-{d:02d}"))

    return min(cands)[1] if cands else None


def extract_generic(html: str, hint: str = "generic") -> dict:
    """Extract fields from an arbitrary official page (no `data-field` markup).

    Real government pages are messy, so this is deliberately conservative: it
    reports low confidence unless it finds strong signals, and the pipeline only
    reconciles a curated cycle when confidence clears the bar. Never raises.
    """
    try:
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = re.sub(r"\s+", " ", soup.get_text(" "))
    except Exception:
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))

    low = text.lower()

    # Vacancy: a number sitting next to a vacancy/post keyword.
    vacancy = None
    for m in re.finditer(
        r"([\d,]{2,})\s*(?:vacanc|post|seat)|"
        r"(?:vacanc\w*|posts?|seats?)\D{0,20}?([\d,]{2,})",
        low,
    ):
        cand = _to_int(m.group(1) or m.group(2))
        if cand and 1 <= cand <= 500000:
            vacancy = cand
            break

    # Dates: label -> ISO, keyed off common notice phrases.
    date_labels = [
        ("last date", "Last date to apply", True),
        ("closing date", "Closing date", True),
        ("last date to apply", "Last date to apply", True),
        ("start date", "Application starts", False),
        ("application begin", "Application starts", False),
        ("exam date", "Exam date", False),
        ("notification", "Notification", False),
    ]
    dates: list[dict] = []
    seen: set[str] = set()
    for needle, label, is_deadline in date_labels:
        idx = low.find(needle)
        if idx == -1:
            continue
        window = text[idx: idx + 80]
        iso = _parse_date(window)
        if iso and label not in seen:
            dates.append({"label": label, "date": iso, "is_deadline": is_deadline})
            seen.add(label)

    # Release signals: does the page announce a result / answer key / admit card?
    # Used by the pipeline to emit "updates" rows for the site's results feed.
    signals_found: list[str] = []
    for phrase, tag in [
        (r"result[s]?\s+(?:declared|announced|out|published)", "result"),
        (r"final\s+(?:result|merit\s+list)", "result"),
        (r"answer\s+key[s]?\s+(?:uploaded|released|published)", "answer_key"),
        (r"admit\s+card[s]?\s+(?:released|available|out)|hall\s+ticket", "admit_card"),
    ]:
        if re.search(phrase, low) and tag not in signals_found:
            signals_found.append(tag)

    signals = (1 if vacancy else 0) + (1 if dates else 0)
    confidence = round(min(0.4 + 0.2 * signals, 0.9), 2) if signals else 0.3

    return {
        "title": None,
        "vacancy": vacancy,
        "qualification": None,
        "age_min": None,
        "age_max": None,
        "dates": dates,
        "releases": signals_found,
        "confidence": confidence,
        "hint": hint,
        "_via": "generic",
    }


class LLMExtractor:
    """LLM structured extraction via OpenRouter — returns the SAME dict shape as
    `extract_from_html`, so the validation gate never changes. Falls back to the
    rule-based extractor when no OPENROUTER_API_KEY is set or on any LLM error."""

    SCHEMA_HINT = (
        '{"title": str, "vacancy": int|null, "qualification": str|null, '
        '"age_min": int|null, "age_max": int|null, '
        '"dates": [{"label": str, "date": "YYYY-MM-DD", "is_deadline": bool}]}'
    )

    def __init__(self, client=None):
        from ..llm.openrouter import OpenRouterClient
        self.client = client or OpenRouterClient()

    @property
    def available(self) -> bool:
        return self.client.available

    def extract(self, html: str, hint: str = "generic") -> dict:
        if not self.client.available:
            return extract_from_html(html, hint)
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))[:6000]
        try:
            data = self.client.chat_json([
                {"role": "system", "content":
                    "Extract Indian government-exam notification fields as strict JSON matching this schema: "
                    + self.SCHEMA_HINT + ". Use null when unknown. Dates must be ISO YYYY-MM-DD."},
                {"role": "user", "content": f"Notification text:\n{text}"},
            ], max_tokens=600)
        except Exception:
            return extract_from_html(html, hint)
        data.setdefault("dates", [])
        present = sum(data.get(k) is not None for k in ("title", "vacancy", "qualification", "age_min"))
        data["confidence"] = round(min(0.6 + 0.1 * present, 0.99), 2)
        data["hint"], data["_via"] = hint, "openrouter"
        return data
