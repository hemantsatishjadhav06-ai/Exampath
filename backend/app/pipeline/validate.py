"""Validation engine — the '> 90% score -> publish' gate.

Combines hard rule checks with weighted soft checks into a single 0-100 score and a
human-readable report. Anything below the threshold, or failing a hard check, is blocked.
"""
from __future__ import annotations
from datetime import date

HARD_CHECKS = {"required_fields", "vacancy_positive", "dates_valid"}
REQUIRED = ["id", "body", "exam", "title", "status", "vacancy", "age_min", "age_max"]


def validate_cycle(c: dict, threshold: float = 90.0) -> dict:
    checks: list[dict] = []

    def add(name: str, passed: bool, weight: int, detail: str = ""):
        checks.append({"name": name, "passed": bool(passed), "weight": weight, "detail": detail})

    missing = [f for f in REQUIRED if c.get(f) in (None, "") and c.get(f) != 0]
    add("required_fields", not missing, 30, f"missing: {missing}" if missing else "ok")

    add("vacancy_positive", isinstance(c.get("vacancy"), int) and c["vacancy"] > 0, 15)

    age_ok = (isinstance(c.get("age_min"), int) and isinstance(c.get("age_max"), int)
              and 14 <= c["age_min"] <= c["age_max"] <= 60)
    add("age_sane", age_ok, 15)

    dates_ok, detail = True, ""
    for d in c.get("dates", []):
        try:
            date.fromisoformat(d["date"])
        except Exception:
            dates_ok, detail = False, f'bad date: {d.get("date")}'
    add("dates_valid", dates_ok, 20, detail)

    add("has_links", len(c.get("links", [])) > 0, 10)

    official = any(
        ".gov.in" in l.get("url", "") or "ibps.in" in l.get("url", "")
        or l.get("kind") == "Notification"
        for l in c.get("links", [])
    )
    add("has_official_source", official, 10)

    total = sum(ck["weight"] for ck in checks)
    got = sum(ck["weight"] for ck in checks if ck["passed"])
    score = round(got / total * 100, 1)

    hard_ok = all(ck["passed"] for ck in checks if ck["name"] in HARD_CHECKS)
    passed = score >= threshold and hard_ok

    report = (f"score={score} passed={passed}; "
              + "; ".join(f'{ck["name"]}:{"Y" if ck["passed"] else "N"}' for ck in checks))
    return {"score": score, "passed": passed, "threshold": threshold,
            "checks": checks, "report": report}
