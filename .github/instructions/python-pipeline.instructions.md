---
applyTo: 'backend/**/*.py'
description: 'Conventions for the ExamPath Python scraper/pipeline/API code: stdlib-only, quality-gated data, safe live scraping.'
---

# Python pipeline & API conventions

- **Standard library only.** No pip dependencies; `urllib.request` for HTTP,
  `sqlite3` for storage, `unittest` for tests. If something seems to need a
  package, it belongs in a different service, not here.
- **Every published fact must trace to an official source.** New data enters
  through `backend/seed/curated.json` (with source links) or through the
  live reconcile in `app/pipeline/run.py`. Scraped values are applied only
  when `extract_generic` confidence ≥ `RECONCILE_MIN_CONFIDENCE` (0.6);
  release phrases (result/answer key/admit card) may apply below that
  because the regexes are precise. Keep that asymmetry.
- **The 90% validation gate is the contract.** `validate.py` blocks any
  cycle scoring ≤ 90 from publishing. Never weaken the gate to make a test
  pass — fix the data instead.
- **A page may only change the exam it names.** `reconcile_live` gates
  every fetched page through `page_mentions(html, exam_keywords(cycle))`;
  a body home page shared by ten exams must not push one exam's vacancy
  count into the other nine. Keep that gate in front of both fact
  application and release detection.
- **Updater bookkeeping is not data.** `app/pipeline/update.py` decides
  what to publish by diffing tracked facts (`changes.TRACKED_FIELDS`), not
  file bytes; new fields that are derived (timestamps, hashes, AI guidance)
  stay out of that list. Feed rows written by code carry `published_at`.
- **Scrapes must never fail the run.** Wrap fetches so a down site logs
  `kept curated` and continues; timeouts stay short (site outages are
  normal for government portals).
- **Be a polite scraper**: honour the existing per-request timeout and the
  up-to-3-sources-per-cycle cap; do not add parallel hammering of one host.
- Tests live in `backend/tests`; they are network-free (fixtures under
  `backend/sources/`). New extractor behaviour needs a fixture-based test.
- API endpoints in `app/api/server.py` return JSON via `_send`, include
  CORS headers, and guard mutating routes with env-var secrets
  (`PIPELINE_RUN_SECRET`, `N8N_WEBHOOK_SECRET`).
