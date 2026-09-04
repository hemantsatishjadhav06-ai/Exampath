"""Change detection between two published datasets + the public changelog.

The auto-update system runs the pipeline several times a day. Most runs find
nothing new, so the interesting question is never "did the file change?" (it
always does — timestamps) but "did any *fact a student cares about* change?".

This module answers that with pure functions:

  diff_datasets(previous, current)  -> list[Change]   (material changes only)
  changes_to_feed_rows(changes)     -> site "updates" rows, one per change,
                                       every one carrying a machine-readable
                                       `published_at` date
  append_changelog(path, entry)     -> bounded JSON ring buffer the site and
                                       the API expose for transparency

Nothing here invents a fact: every change record is the delta between two
datasets that already passed the 90% validation gate, and every feed row
quotes the new official value verbatim.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import date
from pathlib import Path
from typing import Any, Iterable

# Fields whose change is *material* — worth a changelog line and a feed row.
# Everything else (timestamps, agent guidance, hashes) is derived or bookkeeping.
TRACKED_FIELDS = ("vacancy", "status", "dates", "links", "age_min", "age_max",
                  "qualification", "title")

# Per-cycle cap on the "updates" feed so live runs cannot grow it unboundedly.
MAX_UPDATES_PER_CYCLE = 8

# Default cap on the public changelog (entries = runs that changed something).
MAX_CHANGELOG_ENTRIES = 200


@dataclass(frozen=True)
class Change:
    cycle: str          # cycle id, or "" for dataset-level changes
    kind: str           # added | removed | changed
    field: str          # tracked field, e.g. "vacancy", "dates.Last date to apply"
    old: Any
    new: Any

    def to_dict(self) -> dict:
        return asdict(self)


def _by_id(dataset: dict | None) -> dict[str, dict]:
    return {c["id"]: c for c in (dataset or {}).get("cycles", []) if c.get("id")}


def _dates_by_label(cycle: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for d in cycle.get("dates", []) or []:
        if d.get("label") and d.get("date"):
            out[str(d["label"])] = str(d["date"])
    return out


def _link_urls(cycle: dict) -> dict[str, str]:
    return {str(l.get("kind") or l.get("label") or ""): str(l.get("url") or "")
            for l in cycle.get("links", []) or []}


def diff_cycle(cid: str, old: dict, new: dict) -> list[Change]:
    """Material differences between two versions of one cycle."""
    out: list[Change] = []
    for field in TRACKED_FIELDS:
        if field == "dates":
            a, b = _dates_by_label(old), _dates_by_label(new)
            for label in sorted(set(a) | set(b)):
                if a.get(label) != b.get(label):
                    out.append(Change(cid, "changed", f"dates.{label}", a.get(label), b.get(label)))
        elif field == "links":
            a, b = _link_urls(old), _link_urls(new)
            for kind in sorted(set(a) | set(b)):
                if a.get(kind) != b.get(kind):
                    out.append(Change(cid, "changed", f"links.{kind}", a.get(kind), b.get(kind)))
        else:
            if old.get(field) != new.get(field):
                out.append(Change(cid, "changed", field, old.get(field), new.get(field)))
    return out


def diff_datasets(previous: dict | None, current: dict) -> list[Change]:
    """All material changes from `previous` to `current` (added/removed cycles
    plus per-field changes). Deterministic ordering (by cycle id, then field)."""
    prev, cur = _by_id(previous), _by_id(current)
    out: list[Change] = []
    for cid in sorted(set(prev) | set(cur)):
        if cid not in prev:
            out.append(Change(cid, "added", "cycle", None, cur[cid].get("title")))
        elif cid not in cur:
            out.append(Change(cid, "removed", "cycle", prev[cid].get("title"), None))
        else:
            out.extend(diff_cycle(cid, prev[cid], cur[cid]))
    return out


# --------------------------------------------------------------------------- #
# Human/site-facing rendering
# --------------------------------------------------------------------------- #
def _inr(n: Any) -> str:
    try:
        return f"{int(n):,}"
    except (TypeError, ValueError):
        return str(n)


def _fmt_date(iso: Any) -> str:
    try:
        return date.fromisoformat(str(iso)).strftime("%d %b %Y")
    except (TypeError, ValueError):
        return str(iso)


STATUS_WORDS = {
    "application_open": "Applications open", "closing_soon": "Closing soon",
    "upcoming": "Upcoming", "admit_card": "Admit card out",
    "result_awaited": "Result awaited", "result_out": "Result out", "completed": "Completed",
}


def describe(ch: Change) -> str:
    """One plain-English sentence per change, quoting the official value."""
    if ch.kind == "added":
        return f"New exam cycle tracked: {ch.new}"
    if ch.kind == "removed":
        return f"Exam cycle no longer published: {ch.old}"
    if ch.field == "vacancy":
        return f"Vacancies updated on the official site: {_inr(ch.old)} → {_inr(ch.new)}"
    if ch.field == "status":
        return f"Status: {STATUS_WORDS.get(str(ch.old), ch.old)} → {STATUS_WORDS.get(str(ch.new), ch.new)}"
    if ch.field.startswith("dates."):
        label = ch.field.split(".", 1)[1]
        if ch.old is None:
            return f"{label}: {_fmt_date(ch.new)} (new official date)"
        if ch.new is None:
            return f"{label} removed from the official notice"
        return f"{label} changed: {_fmt_date(ch.old)} → {_fmt_date(ch.new)}"
    if ch.field.startswith("links."):
        return f"Official {ch.field.split('.', 1)[1]} link updated"
    return f"{ch.field.replace('_', ' ').capitalize()} updated: {ch.old} → {ch.new}"


# Feed "kind" used by the site's icon map: date | admit | new | info | result
def _feed_kind(ch: Change) -> str:
    if ch.kind == "added":
        return "new"
    if ch.field.startswith("dates."):
        return "date"
    if ch.field == "status":
        return {"admit_card": "admit", "result_out": "result",
                "application_open": "new"}.get(str(ch.new), "info")
    return "info"


# Changes that deserve a row in the student-facing feed. Status flips are
# excluded on purpose: the agent recomputes status daily from dates, so they
# are consequences, not news; the date change that caused them is the news.
FEED_FIELDS = ("vacancy",)


def changes_to_feed_rows(changes: Iterable[Change], today: date | None = None) -> dict[str, list[dict]]:
    """Group feed-worthy changes into `updates` rows per cycle id."""
    today = today or date.today()
    rows: dict[str, list[dict]] = {}
    for ch in changes:
        if ch.kind == "added" or ch.field in FEED_FIELDS or ch.field.startswith("dates."):
            rows.setdefault(ch.cycle, []).append({
                "text": describe(ch), "kind": _feed_kind(ch),
                "when": "today", "published_at": today.isoformat(),
                "source": "official-site",
            })
    return rows


def merge_feed_rows(dataset: dict, rows: dict[str, list[dict]],
                    cap: int = MAX_UPDATES_PER_CYCLE) -> int:
    """Prepend new rows into each cycle's `updates` (deduped by text, capped).
    Returns the number of rows actually inserted."""
    inserted = 0
    for c in dataset.get("cycles", []):
        new_rows = rows.get(c.get("id"))
        if not new_rows:
            continue
        ups = c.setdefault("updates", [])
        seen = {u.get("text") for u in ups}
        for r in reversed(new_rows):
            if r["text"] in seen:
                continue
            ups.insert(0, r)
            seen.add(r["text"])
            inserted += 1
        del ups[cap:]
    return inserted


def summarize(changes: list[Change]) -> dict:
    """Counts + grouped descriptions, ready for JSON or markdown."""
    by_cycle: dict[str, list[str]] = {}
    for ch in changes:
        by_cycle.setdefault(ch.cycle, []).append(describe(ch))
    return {
        "total": len(changes),
        "added": sum(ch.kind == "added" for ch in changes),
        "removed": sum(ch.kind == "removed" for ch in changes),
        "changed": sum(ch.kind == "changed" for ch in changes),
        "cycles": by_cycle,
    }


def to_markdown(changes: list[Change]) -> str:
    if not changes:
        return "_No material data changes._"
    s = summarize(changes)
    lines = [f"**{s['total']} change(s)** across {len(s['cycles'])} cycle(s) "
             f"(added {s['added']}, removed {s['removed']}, changed {s['changed']})", ""]
    for cid, descs in s["cycles"].items():
        lines.append(f"- `{cid}`")
        lines.extend(f"  - {d}" for d in descs)
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Changelog (bounded, newest first)
# --------------------------------------------------------------------------- #
def load_changelog(path: str | Path) -> dict:
    p = Path(path)
    if not p.exists():
        return {"entries": []}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"entries": []}
    data.setdefault("entries", [])
    return data


def append_changelog(path: str | Path, entry: dict,
                     max_entries: int = MAX_CHANGELOG_ENTRIES) -> dict:
    """Prepend `entry` and persist; keeps at most `max_entries`."""
    data = load_changelog(path)
    data["entries"].insert(0, entry)
    del data["entries"][max_entries:]
    data["updated_at"] = entry.get("run_at")
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return data


def changelog_entry(run_at: str, mode: str, changes: list[Change], *,
                    published: int, blocked: int, sources: dict | None = None) -> dict:
    ok = sum(1 for s in (sources or {}).values() if s.get("ok"))
    return {
        "run_at": run_at,
        "mode": mode,
        "published_cycles": published,
        "blocked_cycles": blocked,
        "sources_checked": len(sources or {}),
        "sources_ok": ok,
        "changes": [ch.to_dict() | {"text": describe(ch)} for ch in changes],
    }
