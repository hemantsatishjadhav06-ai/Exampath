"""Persistent state of the auto-update system (data/update-state.json).

The pipeline itself is stateless — every run starts from the curated seed.
That is the right design for correctness, but it leaves three questions
unanswerable from one run alone:

  * did this official page actually change since we last looked?
  * how many runs in a row has a source been failing?
  * when did we last successfully refresh, and what happened in recent runs?

This module keeps that memory in a small JSON file committed next to the
dataset, so it survives between CI runs with no database. Everything is
bounded (fixed history length) so the file never grows without limit.

Shape:
{
  "version": 1,
  "last_run":  {...summary of the most recent run...},
  "last_change_at": "2026-09-04T07:31:02+00:00",   # last run that changed facts
  "sources": { "<cycle id>": {"url", "hash", "status", "ok", "last_ok",
                               "last_checked", "failures"} },
  "runs": [ {...newest first, at most MAX_RUNS...} ]
}
"""
from __future__ import annotations

import json
from pathlib import Path

STATE_VERSION = 1
MAX_RUNS = 60          # ~2 weeks at 4 runs/day
FAILURE_ALERT_AFTER = 3   # consecutive failed runs before a source is "alerting"


def empty_state() -> dict:
    return {"version": STATE_VERSION, "last_run": None, "last_change_at": None,
            "sources": {}, "runs": []}


def load_state(path: str | Path) -> dict:
    p = Path(path)
    if not p.exists():
        return empty_state()
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return empty_state()
    base = empty_state()
    base.update({k: v for k, v in data.items() if k in base})
    return base


def save_state(path: str | Path, state: dict) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def record_sources(state: dict, sources: dict, now: str) -> list[str]:
    """Fold a run's per-cycle source report into the state.

    `sources` is the pipeline's report: {cycle id: {url, ok, http, confidence,
    hash, applied}}. Returns the ids whose `changed` flag flipped on this run
    (official page content differs from the last stored hash)."""
    changed: list[str] = []
    for cid, rep in sources.items():
        prev = state["sources"].get(cid, {})
        entry = {
            "url": rep.get("url") or prev.get("url"),
            "last_checked": now,
            "ok": bool(rep.get("ok")),
            "http": rep.get("http"),
            "confidence": rep.get("confidence"),
        }
        if rep.get("ok"):
            entry["hash"] = rep.get("hash")
            entry["last_ok"] = now
            entry["failures"] = 0
            if prev.get("hash") and prev.get("hash") != rep.get("hash"):
                changed.append(cid)
        else:
            entry["hash"] = prev.get("hash")
            entry["last_ok"] = prev.get("last_ok")
            entry["failures"] = int(prev.get("failures", 0)) + 1
        state["sources"][cid] = entry
    return changed


def alerting_sources(state: dict, threshold: int = FAILURE_ALERT_AFTER) -> list[dict]:
    """Sources that have failed `threshold`+ runs in a row (worth a human look)."""
    out = []
    for cid, s in state.get("sources", {}).items():
        if int(s.get("failures", 0)) >= threshold:
            out.append({"cycle": cid, "url": s.get("url"), "failures": s["failures"],
                        "last_ok": s.get("last_ok")})
    return sorted(out, key=lambda x: -x["failures"])


def record_run(state: dict, summary: dict, max_runs: int = MAX_RUNS) -> None:
    """Push a run summary (newest first) and update the headline fields."""
    state["last_run"] = summary
    if summary.get("changes", 0):
        state["last_change_at"] = summary.get("run_at")
    state["runs"].insert(0, summary)
    del state["runs"][max_runs:]
