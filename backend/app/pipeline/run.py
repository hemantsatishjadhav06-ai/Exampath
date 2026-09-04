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
import re
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

# Words too generic to identify an exam on a conducting body's page.
_GENERIC_WORDS = {
    "exam", "examination", "examinations", "recruitment", "services", "service",
    "combined", "competitive", "state", "and", "the", "of", "level", "test", "grade",
    "officer", "officers", "assistant", "junior", "upper", "subordinate", "central",
    "office", "group", "eligibility", "national", "commission", "board", "india",
}


def exam_keywords(cycle: dict, body: dict | None = None) -> set[str]:
    """Words/phrases that identify THIS exam on its conducting body's pages,
    e.g. {"cgl"} for SSC CGL, {"grade b"} for RBI Grade B, {"po"} for IBPS PO.

    Body names are excluded (every SSC page says "SSC"), as are generic words,
    so a page must actually talk about the exam before we take facts from it.
    """
    body = body or {}
    body_toks = set(re.findall(r"[a-z0-9]+", " ".join(
        str(x) for x in (body.get("short", ""), body.get("name", ""), cycle.get("body", ""))).lower()))
    toks = set(re.findall(r"[a-z0-9]+", f"{cycle.get('exam', '')} {cycle.get('title', '')}".lower()))
    keys = {t for t in toks - body_toks - _GENERIC_WORDS if len(t) >= 3 and not t.isdigit()}
    phrase = " ".join(t for t in re.findall(r"[a-z0-9]+", str(cycle.get("exam", "")).lower())
                      if t not in body_toks and not t.isdigit())
    if phrase:
        keys.add(phrase)
    return keys


def page_mentions(html: str, keywords: set[str]) -> bool:
    """True when the page text contains any keyword as a whole word/phrase."""
    if not keywords:
        return True
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).lower()
    return any(re.search(r"(?<![a-z0-9])" + re.escape(k) + r"(?![a-z0-9])", text) for k in keywords)


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
    """Update dates by label (case-insensitive, so the extractor's
    "Last date to apply" refreshes the curated "Last Date to Apply" row
    instead of adding a duplicate). The curated label text is kept."""
    by_key = {d["label"].lower(): dict(d) for d in existing}
    for d in found:
        key = d["label"].lower()
        cur = by_key.get(key, {})
        by_key[key] = {**cur, **d, "label": cur.get("label", d["label"])}
    return list(by_key.values())


def reconcile_live(cycles: dict, bodies_by_slug: dict, log: list[str],
                   scraper: HttpScraper | None = None,
                   report: dict | None = None) -> None:
    """Fetch each cycle's official page and fold confident findings back in.

    When `report` is given, one structured entry per cycle is written into
    it ({cycle id: {url, ok, http, confidence, hash, applied, error}}) so the
    auto-update tool can track sources across runs without parsing the log.
    """
    scraper = scraper or HttpScraper()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    today = now[:10]
    for cid, c in cycles.items():
        urls = notice_urls(c, bodies_by_slug)[:3]   # try up to 3 sources per cycle
        if not urls:
            continue
        keywords = exam_keywords(c, bodies_by_slug.get(c.get("body")))
        best, best_url, tried, last_err = None, None, 0, None
        for url in urls:
            try:
                res = scraper.fetch(url)
            except Exception as e:                   # site down / timeout: try next
                last_err = f"{type(e).__name__}: {e}"[:160]
                continue
            tried += 1
            ext = extract_generic(res.html, hint=cid)
            # A body's home page is shared by all its exams; only a page that
            # actually names THIS exam may change its facts. Irrelevant pages
            # still count as "reachable" (hash + last_checked) but apply nothing.
            ext["relevant"] = page_mentions(res.html, keywords)
            score = ext["confidence"] if ext["relevant"] else -1
            if best is None or score > best[2]:
                best, best_url = (res, ext, score), url
            if ext["relevant"] and ext["confidence"] >= RECONCILE_MIN_CONFIDENCE:
                break                                # good enough — stop early
        if best is None:
            log.append(f"[live   ] {cid:16s} all {len(urls)} sources FAILED — kept curated")
            if report is not None:
                report[cid] = {"url": urls[0], "ok": False, "http": None, "confidence": None,
                               "hash": None, "applied": [], "error": last_err}
            continue
        res, ext, _ = best
        c["source_hash"] = res.content_hash
        c["last_checked"] = now
        applied = []
        if not ext["relevant"]:
            log.append(f"[live   ] {cid:16s} http={res.status} page does not mention "
                       f"{'/'.join(sorted(keywords))} — nothing applied")
            if report is not None:
                report[cid] = {"url": best_url, "ok": True, "http": res.status, "relevant": False,
                               "confidence": ext["confidence"], "hash": res.content_hash,
                               "applied": [], "error": None}
            continue
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
                # `published_at` is the machine-readable date the site sorts
                # and labels by; `when` stays as a fallback for old readers.
                ups.insert(0, {"text": text, "kind": ukind, "when": "today",
                               "published_at": today, "source": best_url})
                applied.append(f"release:{tag}")
        log.append(
            f"[live   ] {cid:16s} http={res.status} conf={ext['confidence']} "
            f"src={tried}/{len(urls)} applied={','.join(applied) or 'none'}"
        )
        if report is not None:
            report[cid] = {"url": best_url, "ok": True, "http": res.status, "relevant": True,
                           "confidence": ext["confidence"], "hash": res.content_hash,
                           "applied": applied, "error": None}


def run(export_path: str | None = None, verbose: bool = True,
        live: bool | None = None, log_sink: list[str] | None = None,
        *, publish: bool = True, scraper: HttpScraper | None = None,
        report: dict | None = None) -> dict:
    """Run the whole pipeline once and return the published dataset.

    publish=False skips the Supabase upsert (dry runs / the update tool's
    `check` mode). `scraper` lets tests inject a fake HttpScraper; `report`
    receives the per-source outcome (see reconcile_live).
    """
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
        reconcile_live(cycles, bodies_by_slug, log, scraper=scraper, report=report)

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
    # 4b. autonomous guidance agent: reconcile statuses against their own dates
    #     and write the next-action guidance + daily briefing into the dataset.
    from ..ai.agent import run_agent
    rep = run_agent(dataset)
    log.append(f"[agent  ] status corrections={len(rep['corrections'])} "
               f"needs_refresh={len(rep['stale'])} urgent={len(rep['urgent'])}")
    for corr in rep["corrections"]:
        log.append(f"[agent  ] {corr['id']:16s} status {corr['from']} -> {corr['to']} (from its own dates)")

    out = export_path or str(ROOT / "data" / "exams.json")
    export_json(dataset, out)
    save_sqlite(dataset, BACKEND / "exampath.db")
    log.append(f"[done   ] published={len(published)} blocked={len(blocked)} -> {out}")

    # 5b. durable store + API (no-op unless SUPABASE_URL + service key are set)
    if publish:
        publish_to_supabase(dataset, log=log)
    else:
        log.append("[supabase] publish skipped (dry run)")

    if verbose:
        print("\n".join(log))
    return dataset


if __name__ == "__main__":
    run()
