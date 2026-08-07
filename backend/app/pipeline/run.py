"""Pipeline orchestrator: scrape -> extract -> validate (90% gate) -> store/publish.

Mirrors the production n8n flow, but runnable as one Python process:
  1. Scrape sample official notices (FixtureScraper; swap for HttpScraper to go live).
  2. Extract structured fields from each notice.
  3. Merge with the curated knowledge base (seed/curated.json).
  4. Validate every cycle through the > 90% gate.
  5. Publish the passing set to data/exams.json (+ SQLite mirror).
"""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path

from ..scrapers.sources import FixtureScraper
from .extract import extract_from_html
from .validate import validate_cycle
from .store import export_json, save_sqlite

BACKEND = Path(__file__).resolve().parents[2]     # .../backend
ROOT = Path(__file__).resolve().parents[3]         # repo root

# Which curated cycles also have a scrapeable sample notice (demonstrates scrape+extract).
FIXTURES = {"ssc-cgl-2026": "ssc-cgl.html", "ibps-po-2026": "ibps-po.html"}


def load_curated() -> dict:
    return json.loads((BACKEND / "seed" / "curated.json").read_text(encoding="utf-8"))


def run(export_path: str | None = None, verbose: bool = True) -> dict:
    curated = load_curated()
    cycles = {c["id"]: dict(c) for c in curated["cycles"]}
    scraper = FixtureScraper(BACKEND / "sources")
    log: list[str] = []

    # 1-3. scrape + extract the sample notices and reconcile core fields with the KB
    for cid, fname in FIXTURES.items():
        res = scraper.fetch(fname)
        ext = extract_from_html(res.html)
        log.append(f"[scrape ] {fname} http={res.status} changed={res.changed} "
                   f"-> vacancy={ext['vacancy']} conf={ext['confidence']}")
        if cid in cycles and ext.get("vacancy"):
            cycles[cid]["vacancy"] = ext["vacancy"]  # reconcile with official notice

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

    if verbose:
        print("\n".join(log))
    return dataset


if __name__ == "__main__":
    run()
