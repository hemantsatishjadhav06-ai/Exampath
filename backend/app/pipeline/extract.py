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


class LLMExtractor:
    """Drop-in point for an LLM structured-output extractor (Claude/GPT).

    Wire this to your provider and return the same dict shape as `extract_from_html`.
    Keeping the interface identical means the validation gate never changes.
    """

    def __init__(self, model: str = "claude", api_key: str | None = None):
        self.model = model
        self.api_key = api_key

    def extract(self, html: str, hint: str = "generic") -> dict:  # pragma: no cover
        raise NotImplementedError("Connect your LLM provider here.")
