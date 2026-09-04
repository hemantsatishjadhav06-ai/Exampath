"""ExamPath auto-update tool — check official sources and refresh the website data.

    python -m app.pipeline.update check   [--live | --no-live] [--report FILE]
    python -m app.pipeline.update apply   [--live | --no-live] [--report FILE] [--force]
    python -m app.pipeline.update status  [--max-age-hours N] [--json]

`check`  runs the full pipeline (scrape -> extract -> 90% gate -> agent) into a
         scratch file and reports what WOULD change versus the published
         data/exams.json. Nothing is written, nothing is pushed to Supabase.
`apply`  does the same, then — if the safety guards pass — writes the new
         dataset to data/exams.json and web/data/exams.json, appends the
         public changelog, updates data/update-state.json and publishes to
         Supabase when configured. It only rewrites the files when a fact
         changed or the day rolled over (the site recomputes "days left"
         from `generated_at`), so unchanged runs leave the tree untouched.
`status` reports freshness: dataset age, last run, sources failing in a row,
         cycles awaiting a new official notice. Exits 1 when the dataset is
         older than --max-age-hours (a monitor for "the updater stopped").

Exit codes: 0 ok · 1 error · 2 refused by a safety guard (old data kept).

Designed for GitHub Actions: with GITHUB_OUTPUT / GITHUB_STEP_SUMMARY set it
emits `changed=true|false`, `material=<n>` outputs and a markdown summary.
Zero third-party dependencies beyond what the pipeline already uses.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone, date
from pathlib import Path

from .changes import (diff_datasets, changes_to_feed_rows, merge_feed_rows, summarize,
                      to_markdown, append_changelog, changelog_entry, MAX_UPDATES_PER_CYCLE)
from .state import load_state, save_state, record_sources, record_run, alerting_sources
from .store import export_json
from ..publish import publish_to_supabase

ROOT = Path(__file__).resolve().parents[3]

# Fields that live reconcile derives from the official page. When a source is
# unreachable on a later run we keep the last published value of these instead
# of silently reverting to the curated seed (which would make facts flip-flop
# and spam the changelog every time a government portal has a bad hour).
LIVE_FIELDS = ("vacancy", "dates", "last_checked", "source_hash")

# `apply` refuses to publish when the new dataset has lost more than this share
# of the previously published cycles — a scrape/gate regression, not news.
MIN_CYCLE_RATIO = 0.8

# `status` considers the dataset stale after this many hours without a refresh.
DEFAULT_MAX_AGE_HOURS = 36


class Paths:
    def __init__(self, root: Path):
        self.root = root
        self.dataset = root / "data" / "exams.json"
        self.web_dataset = root / "web" / "data" / "exams.json"
        self.changelog = root / "data" / "changelog.json"
        self.state = root / "data" / "update-state.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _load_json(p: Path) -> dict | None:
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


# --------------------------------------------------------------------------- #
# Carry-forward: make the stateless pipeline remember what it already published
# --------------------------------------------------------------------------- #
def carry_forward(previous: dict | None, dataset: dict, report: dict) -> list[str]:
    """Copy last-good live facts and machine-generated feed rows from the
    previously published dataset into the fresh one.

    * A cycle whose official source was NOT successfully read this run keeps
      the live fields it was last published with (if it had any).
    * Feed rows the updater wrote earlier (they carry `published_at`) are kept
      with their original date, so "Result declared" does not become "today"
      on every run. Curated rows are untouched.
    Returns the ids whose live fields were carried forward.
    """
    if not previous:
        return []
    prev_by_id = {c["id"]: c for c in previous.get("cycles", []) if c.get("id")}
    kept: list[str] = []
    for c in dataset.get("cycles", []):
        p = prev_by_id.get(c.get("id"))
        if not p:
            continue
        fetched_ok = bool(report.get(c["id"], {}).get("ok"))
        if not fetched_ok and p.get("last_checked"):
            for f in LIVE_FIELDS:
                if f in p:
                    c[f] = p[f]
            kept.append(c["id"])
        # feed rows: keep earlier machine-written rows and their dates
        ups = c.setdefault("updates", [])
        by_text = {u.get("text"): u for u in ups}
        carried = []
        for u in p.get("updates", []) or []:
            if not u.get("published_at"):
                continue                       # curated row: seed is the source of truth
            cur = by_text.get(u.get("text"))
            if cur is None:
                carried.append(u)
            elif not cur.get("published_at") or cur["published_at"] > u["published_at"]:
                cur["published_at"] = u["published_at"]
        if carried:
            ups[0:0] = carried
            del ups[MAX_UPDATES_PER_CYCLE:]
    return kept


# --------------------------------------------------------------------------- #
# Core
# --------------------------------------------------------------------------- #
def run_update(mode: str, *, live: bool, root: Path | None = None, scraper=None,
               force: bool = False, today: date | None = None,
               publish: bool | None = None) -> dict:
    """Run one update cycle. Returns the report dict (see `report_markdown`)."""
    from .run import run as run_pipeline
    from ..ai.agent import run_agent

    assert mode in ("check", "apply")
    paths = Paths(root or ROOT)
    run_at = _now()
    previous = _load_json(paths.dataset)
    state = load_state(paths.state)
    log: list[str] = []
    source_report: dict = {}

    with tempfile.TemporaryDirectory() as tmp:
        dataset = run_pipeline(export_path=str(Path(tmp) / "exams.json"), verbose=False,
                               live=live, log_sink=log, publish=False,
                               scraper=scraper, report=source_report)

    kept = carry_forward(previous, dataset, source_report)
    if kept:
        log.append(f"[update ] kept last-good live data for {len(kept)} cycle(s) whose source "
                   f"was not read this run: {', '.join(kept)}")

    # Carried-forward dates may move a cycle's status: recompute the agent's
    # status/guidance BEFORE diffing, so the diff only ever shows real news.
    agent = run_agent(dataset, today=today)
    changes = diff_datasets(previous, dataset)
    feed_rows = changes_to_feed_rows(changes, today=today)
    inserted = merge_feed_rows(dataset, feed_rows)

    source_changed = record_sources(state, source_report, run_at)
    published = len(dataset.get("cycles", []))
    blocked = sum(1 for l in log if l.startswith("[gate   ]") and "BLOCK" in l)
    prev_count = len((previous or {}).get("cycles", []))
    date_rolled = previous is None or previous.get("generated_at") != dataset.get("generated_at")
    material = bool(changes)

    # ---- safety guards (apply only) ----
    refusal = None
    if published == 0:
        refusal = "no cycle passed the validation gate"
    elif prev_count and published < MIN_CYCLE_RATIO * prev_count:
        refusal = (f"published cycles dropped from {prev_count} to {published} "
                   f"(below {int(MIN_CYCLE_RATIO * 100)}% floor)")

    wrote = False
    supabase = None
    if mode == "apply" and refusal is None:
        if material or date_rolled or force:
            export_json(dataset, paths.dataset)
            export_json(dataset, paths.web_dataset)
            wrote = True
            if material:
                append_changelog(paths.changelog, changelog_entry(
                    run_at, "live" if live else "curated", changes,
                    published=published, blocked=blocked, sources=source_report))
            if publish is None:
                publish = True
            if publish:
                supabase = publish_to_supabase(dataset, log=log)
        else:
            log.append("[update ] no material change and same day — files left untouched")

    summary = {
        "run_at": run_at, "mode": mode, "live": live,
        "published": published, "blocked": blocked,
        "sources_checked": len(source_report),
        "sources_ok": sum(1 for s in source_report.values() if s.get("ok")),
        "sources_changed": len(source_changed),
        "changes": len(changes), "feed_rows": inserted,
        "wrote": wrote, "refused": refusal,
    }
    if mode == "apply":
        record_run(state, summary)
        save_state(paths.state, state)

    report = {
        **summary,
        "generated_at": dataset.get("generated_at"),
        "previous_generated_at": (previous or {}).get("generated_at"),
        "changed": material or date_rolled,
        "material": len(changes),
        "change_summary": summarize(changes),
        "changes_markdown": to_markdown(changes),
        "carried_forward": kept,
        "sources_changed_ids": source_changed,
        "alerting_sources": alerting_sources(state),
        "needs_refresh": list(dataset.get("ai_briefing", {}).get("needs_refresh", [])),
        "agent_corrections": len(agent["corrections"]),
        "supabase_published": supabase,
        "sources": source_report,
        "log": log,
    }
    return report


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #
def report_markdown(r: dict) -> str:
    verb = {"check": "Check (dry run)", "apply": "Apply"}[r["mode"]]
    head = [f"## ExamPath data update — {verb}", "",
            f"- Run at: `{r['run_at']}` · mode: **{'live official sources' if r['live'] else 'curated only'}**",
            f"- Published cycles: **{r['published']}** (blocked by the 90% gate: {r['blocked']})",
            f"- Sources read: {r['sources_ok']}/{r['sources_checked']} ok · "
            f"{r['sources_changed']} page(s) changed since last run",
            f"- Material changes: **{r['material']}** · files written: **{'yes' if r['wrote'] else 'no'}**"
            + (f" · Supabase: {'published' if r['supabase_published'] else 'skipped'}"
               if r["mode"] == "apply" and not r["refused"] else "")]
    if r["refused"]:
        head.append(f"- :rotating_light: **Refused by safety guard:** {r['refused']} — previous data kept.")
    if r["carried_forward"]:
        head.append(f"- Kept last-good live data for {len(r['carried_forward'])} cycle(s) "
                    f"whose source was unreachable: {', '.join(r['carried_forward'])}")
    out = head + ["", "### Changes", r["changes_markdown"]]
    if r["alerting_sources"]:
        out += ["", "### Sources failing repeatedly (needs a human look)"]
        out += [f"- `{a['cycle']}` — {a['failures']} run(s) in a row · {a['url']} · last ok: {a['last_ok'] or 'never'}"
                for a in r["alerting_sources"]]
    if r["needs_refresh"]:
        out += ["", f"### Awaiting a new official notification ({len(r['needs_refresh'])})",
                ", ".join(f"`{c}`" for c in r["needs_refresh"])]
    return "\n".join(out) + "\n"


def _emit_github(r: dict) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"changed={'true' if r['changed'] else 'false'}\n")
            f.write(f"wrote={'true' if r['wrote'] else 'false'}\n")
            f.write(f"material={r['material']}\n")
            f.write(f"refused={r['refused'] or ''}\n")
    summ = os.environ.get("GITHUB_STEP_SUMMARY")
    if summ:
        with open(summ, "a", encoding="utf-8") as f:
            f.write(report_markdown(r))


# --------------------------------------------------------------------------- #
# status
# --------------------------------------------------------------------------- #
def status(root: Path | None = None, max_age_hours: float = DEFAULT_MAX_AGE_HOURS,
           now: datetime | None = None) -> dict:
    paths = Paths(root or ROOT)
    now = now or datetime.now(timezone.utc)
    ds = _load_json(paths.dataset) or {}
    st = load_state(paths.state)
    gen = ds.get("generated_at")
    age_h = None
    if gen:
        try:
            gen_dt = datetime.fromisoformat(str(gen))
            if gen_dt.tzinfo is None:
                gen_dt = gen_dt.replace(tzinfo=timezone.utc)
            age_h = round((now - gen_dt).total_seconds() / 3600, 1)
        except ValueError:
            pass
    last_run = st.get("last_run") or {}
    stale = age_h is None or age_h > max_age_hours
    return {
        "ok": not stale,
        "generated_at": gen,
        "age_hours": age_h,
        "max_age_hours": max_age_hours,
        "cycles": len(ds.get("cycles", [])),
        "last_run_at": last_run.get("run_at"),
        "last_run_wrote": last_run.get("wrote"),
        "last_change_at": st.get("last_change_at"),
        "runs_recorded": len(st.get("runs", [])),
        "alerting_sources": alerting_sources(st),
        "needs_refresh": list(ds.get("ai_briefing", {}).get("needs_refresh", [])),
    }


def status_text(s: dict) -> str:
    lines = [f"ExamPath data status: {'OK' if s['ok'] else 'STALE'}",
             f"  dataset generated_at : {s['generated_at']}  (age {s['age_hours']} h, limit {s['max_age_hours']} h)",
             f"  cycles published     : {s['cycles']}",
             f"  last update run      : {s['last_run_at'] or 'never'}  wrote={s['last_run_wrote']}",
             f"  last material change : {s['last_change_at'] or 'never'}",
             f"  awaiting new notice  : {len(s['needs_refresh'])} cycle(s)"]
    if s["alerting_sources"]:
        lines.append("  sources failing in a row:")
        lines += [f"    - {a['cycle']}: {a['failures']}x  {a['url']}" for a in s["alerting_sources"]]
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _env_truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.pipeline.update", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", type=Path, default=None,
                    help="repository root holding data/ and web/data/ (default: this checkout)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("check", "apply"):
        p = sub.add_parser(name)
        g = p.add_mutually_exclusive_group()
        g.add_argument("--live", action="store_true", help="fetch live official sources (default: $EXAMPATH_LIVE)")
        g.add_argument("--no-live", action="store_true", help="curated dataset only")
        p.add_argument("--report", metavar="FILE", help="write the full JSON report here")
        p.add_argument("--quiet", action="store_true", help="print only the markdown summary")
        if name == "apply":
            p.add_argument("--force", action="store_true", help="rewrite files even if nothing changed")
            p.add_argument("--no-publish", action="store_true", help="skip the Supabase upsert")
    s = sub.add_parser("status")
    s.add_argument("--max-age-hours", type=float, default=DEFAULT_MAX_AGE_HOURS)
    s.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)

    if a.cmd == "status":
        st = status(root=a.root, max_age_hours=a.max_age_hours)
        print(json.dumps(st, indent=2) if a.json else status_text(st))
        return 0 if st["ok"] else 1

    live = True if a.live else False if a.no_live else _env_truthy("EXAMPATH_LIVE")
    try:
        r = run_update(a.cmd, live=live, root=a.root, force=getattr(a, "force", False),
                       publish=False if getattr(a, "no_publish", False) else None)
    except Exception as e:  # never leave a half-written tree; report and fail loudly
        print(f"[update ] ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    if a.report:
        Path(a.report).parent.mkdir(parents=True, exist_ok=True)
        Path(a.report).write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")
    if not a.quiet:
        print("\n".join(r["log"]))
        print()
    print(report_markdown(r))
    _emit_github(r)
    return 2 if r["refused"] else 0


if __name__ == "__main__":
    sys.exit(main())
