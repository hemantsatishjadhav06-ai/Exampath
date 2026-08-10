"""Pipeline orchestrator: scrape -> extract -> validate (90% gate) -> store/publish.

Mirrors the production n8n flow, but runnable as one Python process:
  1. Start from the curated knowledge base (seed/curated.json).
  2. Scrape sample official notices (FixtureScraper) to demonstrate scrape+extract.
  3. LIVE mode (EXAMPATH_LIVE=1): fetch each cycle's official page and reconcile
     vacancy/dates from it, recording last_checked + source_hash. Falls back to
     the curated value on any error, so the run never fails because a site is down.
  4. Validate every cycle through the > 90% gate.
  5. Publish the passing set to data/exams.json (+ SQLite mirror) and, when
     configured, upsert it to Supabase (durable store + API for the website).
"""
from __future__ import annotations
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from ..scrapers.sources import FixtureScraper, HttpScraper
from .extract import extract_from_html, extract_generic
from .validate import validate_cycle
from .store import export_json, save_sqlite
from ..publish import publish_to_supabase

BACKEND = Path(__file__).resolve().parents[2]     # .../backend
ROOT = Path(__file__).resolve().parents[3]         # repo root

# Which curated cycles also have a scrapeable sample notice (demonstrates scrape+extract).
FIXTURES = {"ssc-cgl-2026": "ssc-cgl.html", "ibps-po-2026": "ibps-po.html"}

# Live-reconcile only overwrites a curated value when the scrape is at least this
# confident — govt pages are noisy, so we bias hard towards the verified KB.
RECONCILE_MIN_CONFIDENCE = 0.6


def _env_truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def load_curated() -> dict:
    return json.loads((BACKEND / "seed" / "curated.json").read_text(encoding="utf-8"))


def notice_url(cycle: dict, bodies_by_slug: dict) -> str | None:
    """Best official URL to check for this cycle: a Notification/Apply/Website
    link if present, otherwise the conducting body's official site."""
    order = {"notification": 0, "apply": 1, "website": 2}
    links = sorted(
        cycle.get("links", []),
        key=lambda l: order.get(str(l.get("kind", "")).lower(), 9),
    )
    for l in links:
        if str(l.get("url", "")).startswith("http"):
            return l["url"]
    body = bodies_by_slug.get(cycle.get("body"))
    return (body or {}).get("official_url")


def _merge_dates(existing: list[dict], found: list[dict]) -> list[dict]:
    by_label = {d["label"]: d for d in existing}
    for d in found:
        by_label[d["label"]] = {**by_label.get(d["label"], {}), **d}
    return list(by_label.values())


def reconcile_live(cycles: dict, bodies_by_slug: dict, log: list[str],
                   scraper: HttpScraper | None = None) -> None:
    """Fetch each cycle's official page and fold confident findings back in."""
    scraper = scraper or HttpScraper()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for cid, c in cycles.items():
        url = notice_url(c, bodies_by_slug)
        if not url:
            continue
        try:
            res = scraper.fetch(url)
        except Exception as e:  # network/DNS/timeout — keep curated, note it
            log.append(f"[live   ] {cid:16s} fetch FAILED ({type(e).__name__}) — kept curated")
            continue
        c["source_hash"] = res.content_hash
        c["last_checked"] = now
        ext = extract_generic(res.html, hint=cid)
        applied = []
        if ext["confidence"] >= RECONCILE_MIN_CONFIDENCE:
            if ext.get("vacancy"):
                c["vacancy"] = ext["vacancy"]
                applied.append("vacancy")
            if ext.get("dates"):
                c["dates"] = _merge_dates(c.get("dates", []), ext["dates"])
                applied.append(f"{len(ext['dates'])}d")
        log.append(
            f"[live   ] {cid:16s} http={res.status} conf={ext['confidence']} "
            f"changed={res.changed} applied={','.join(applied) or 'none'}"
        )


def run(export_path: str | None = None, verbose: bool = True,
        live: bool | None = None) -> dict:
    if live is None:
        live = _env_truthy("EXAMPATH_LIVE")

    curated = load_curated()
    bodies_by_slug = {b["slug"]: b for b in curated["bodies"]}
    cycles = {c["id"]: dict(c) for c in curated["cycles"]}
    log: list[str] = []

    # 1-3. demonstrate scrape+extract on the bundled sample notices
    fixture = FixtureScraper(BACKEND / "sources")
    for cid, fname in FIXTURES.items():
        res = fixture.fetch(fname)
        ext = extract_from_html(res.html)
        log.append(f"[scrape ] {fname} http={res.status} changed={res.changed} "
                   f"-> vacancy={ext['vacancy']} conf={ext['confidence']}")
        if cid in cycles and ext.get("vacancy"):
            cycles[cid]["vacancy"] = ext["vacancy"]  # reconcile with official notice

    # 3b. LIVE: reconcile every cycle against its official page
    if live:
        log.append("[live   ] EXAMPATH_LIVE=1 — reconciling against official sources")
        reconcile_live(cycles, bodies_by_slug, log)

    # 4. validate everything through the gate
    published, blocked = [], []
    for cid, c in cycles.items():
        v = validate_cycle(c)
        (published if v["passed"] else blocked).append(c)
        log.append(f"[gate   ] {cid:16s} score={v['score']:5} "
                   f"{'PUBLISH' if v['passed'] else 'BLOCK  '}")

    # 5. publish
    dataset = {
        "generated_at": datetime.now(timezone.utc).date().isoformat(),
        "source": "exampath-pipeline",
        "bodies": curated["bodies"],
        "cycles": published,
    }
    out = export_path or str(ROOT / "data" / "exams.json")
    export_json(dataset, out)
    save_sqlite(dataset, BACKEND / "exampath.db")
    log.append(f"[done   ] published={len(published)} blocked={len(blocked)} -> {out}")

    # 5b. durable store + API (no-op unless SUPABASE_URL + service key are set)
    publish_to_supabase(dataset, log=log)

    if verbose:
        print("\n".join(log))
    return dataset


if __name__ == "__main__":
    run()
