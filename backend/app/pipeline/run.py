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


def notice_urls(cycle: dict, bodies_by_slug: dict) -> list[str]:
    """All official URLs worth checking for this cycle, most specific first:
    the cycle's Notification/Apply/Website links, then the conducting body's
    curated `notice_urls` (dedicated notification pages), then its home page."""
    order = {"notification": 0, "apply": 1, "website": 2}
    urls: list[str] = []
    for l in sorted(cycle.get("links", []),
                    key=lambda l: order.get(str(l.get("kind", "")).lower(), 9)):
        if str(l.get("url", "")).startswith("http"):
            urls.append(l["url"])
    body = bodies_by_slug.get(cycle.get("body")) or {}
    urls.extend(u for u in body.get("notice_urls", []) if str(u).startswith("http"))
    if body.get("official_url"):
        urls.append(body["official_url"])
    seen: set[str] = set()
    return [u for u in urls if not (u in seen or seen.add(u))]


def notice_url(cycle: dict, bodies_by_slug: dict) -> str | None:
    """Best single official URL for this cycle (first of notice_urls)."""
    urls = notice_urls(cycle, bodies_by_slug)
    return urls[0] if urls else None


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
        urls = notice_urls(c, bodies_by_slug)[:3]   # try up to 3 sources per cycle
        if not urls:
            continue
        best, best_url, tried = None, None, 0
        for url in urls:
            try:
                res = scraper.fetch(url)
            except Exception:
                continue
            tried += 1
            ext = extract_generic(res.html, hint=cid)
            if best is None or ext["confidence"] > best[1]["confidence"]:
                best, best_url = (res, ext), url
            if ext["confidence"] >= RECONCILE_MIN_CONFIDENCE:
                break                                # good enough — stop early
        if best is None:
            log.append(f"[live   ] {cid:16s} all {len(urls)} sources FAILED — kept curated")
            continue
        res, ext = best
        c["source_hash"] = res.content_hash
        c["last_checked"] = now
        applied = []
        if ext["confidence"] >= RECONCILE_MIN_CONFIDENCE:
            if ext.get("vacancy"):
                c["vacancy"] = ext["vacancy"]
                applied.append("vacancy")
            if ext.get("dates"):
                c["dates"] = _merge_dates(c.get("dates", []), ext["dates"])
                applied.append(f"{len(ext['dates'])}d")
        # Release detection (result / answer key / admit card) works even at low
        # overall confidence — phrase matches are precise. Each new signal becomes
        # an "update" row for the site feed (deduped against existing updates).
        release_label = {"result": ("Result declared on the official website", "result"),
                         "answer_key": ("Answer key released on the official website", "result"),
                         "admit_card": ("Admit card released on the official website", "admit")}
        for tag in ext.get("releases", []):
            text, ukind = release_label[tag]
            ups = c.setdefault("updates", [])
            if not any(u.get("text") == text for u in ups):
                ups.insert(0, {"text": text, "kind": ukind, "when": "today"})
                applied.append(f"release:{tag}")
        log.append(
            f"[live   ] {cid:16s} http={res.status} conf={ext['confidence']} "
            f"src={tried}/{len(urls)} applied={','.join(applied) or 'none'}"
        )


def run(export_path: str | None = None, verbose: bool = True,
        live: bool | None = None, log_sink: list[str] | None = None) -> dict:
    if live is None:
        live = _env_truthy("EXAMPATH_LIVE")

    curated = load_curated()
    bodies_by_slug = {b["slug"]: b for b in curated["bodies"]}
    cycles = {c["id"]: dict(c) for c in curated["cycles"]}
    # Callers (e.g. the API's /pipeline/run) can pass a list to receive the
    # full per-cycle scrape/gate log for remote debugging.
    log: list[str] = log_sink if log_sink is not None else []

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
