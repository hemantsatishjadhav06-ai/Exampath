# ExamPath auto data update system

How the website's exam data stays current without anyone editing JSON by hand.

```
  official sites ──scrape──▶ extract ──▶ 90% gate ──▶ guidance agent
                                                          │
   data/exams.json (published) ◀── diff ◀── carry-forward ◀┘
          │            │
          │            ├─▶ data/changelog.json      (what changed, when, from where)
          │            └─▶ data/update-state.json   (per-source hash / failure streak / run history)
          ▼
   commit → Supabase → rebuild → GitHub Pages + Render → RSS / sitemap / IndexNow
```

## The tool

Everything runs through one command (from `backend/`):

| Command | What it does | Writes |
| --- | --- | --- |
| `python -m app.pipeline.update check --live` | Full pipeline against the official sources, then a **report of what would change** versus the published data. | nothing |
| `python -m app.pipeline.update apply --live` | Same, then — if the safety guards pass — refreshes the data files, changelog, state and Supabase. | `data/exams.json`, `web/data/exams.json`, `data/changelog.json`, `data/update-state.json` |
| `python -m app.pipeline.update status` | Freshness health: dataset age, last run, sources failing repeatedly, cycles awaiting a new notice. Exit 1 when older than `--max-age-hours` (36). | nothing |

Flags: `--no-live` (curated seed only, no network), `--report FILE` (full JSON
report), `--quiet`, `apply --force` (rewrite even if unchanged), `apply
--no-publish` (skip Supabase), `--root DIR` (operate on another checkout).

Exit codes: `0` ok · `1` error · `2` refused by a safety guard (old data kept).

Inside GitHub Actions the tool also writes `changed`, `wrote`, `material`,
`refused` to `GITHUB_OUTPUT` and a markdown summary to `GITHUB_STEP_SUMMARY`.

## What "a change" means

The pipeline is stateless (every run starts from `backend/seed/curated.json`),
so "the file changed" is meaningless — timestamps always move. The updater
compares only **facts a student cares about** (`changes.py::TRACKED_FIELDS`):
vacancy, status, dates (by label), official links, age limits, qualification,
title, plus added/removed cycles. Bookkeeping (`last_checked`, `source_hash`,
`ai_next`, `ai_briefing`) is ignored.

Each material change becomes:

* a line in `data/changelog.json` (bounded to 200 runs, newest first, also
  served as `/changelog.json` on the site), and
* for vacancy / date changes and new cycles, a row in that exam's "What's new"
  feed with a machine-readable `published_at`. The site turns that into
  "Today" / "3d ago" at build time, measured against the dataset's own date, so
  labels keep ageing correctly on every rebuild.

## Safety rules (never weakened)

1. **Official sources only, exam-relevant pages only.** A conducting body's
   home page is shared by all of its exams. Facts are taken from a page only
   when it actually names the exam (`run.py::exam_keywords` → `cgl`, `grade b`,
   `po` …). An irrelevant page still counts as "reachable" but applies nothing.
2. **Confidence ≥ 0.6 to overwrite a curated value**; release phrases (result /
   answer key / admit card) may apply below that because the regexes are precise.
3. **The 90% validation gate** decides what is published; the updater never
   bypasses it.
4. **Last-good carry-forward.** When a source is unreachable, the cycle keeps
   the live facts it was last published with instead of flip-flopping back to
   the curated seed. Feed rows the updater wrote earlier keep their original
   date.
5. **Regression guard.** `apply` refuses (exit 2, files untouched) when no cycle
   passes the gate or the published count drops below 80% of the previous run.
6. **Quiet when nothing happened.** Files are rewritten only when a fact
   changed or the day rolled over (the site recomputes "days left" from
   `generated_at`), so most runs leave the git tree untouched.

## Schedule and deployment

`.github/workflows/scrape-and-publish.yml` runs `apply --live` **four times a
day** (07:00, 13:00, 19:00, 01:00 IST) and on demand (`workflow_dispatch` with
`mode`, `live`, `force` inputs):

1. `update` job: run the tool, upload the JSON report + log as an artifact,
   commit the data/changelog/state when something was written, print the
   freshness status.
2. `deploy` job (only when a commit was pushed): data audit, minified build,
   GitHub Pages deploy, IndexNow ping. Render redeploys from `main` on its own.
3. `report-failure` job: opens (or comments on) a single
   "Auto data update is failing" issue labelled `auto-update`.

Note: the previous version of this workflow never ran. It used the `secrets`
context inside a step `if`, which GitHub rejects at parse time, so every push
produced an instant failure and no scheduled run was ever created. `actionlint`
now passes on all workflows; keep it that way (`actionlint .github/workflows/*.yml`).

## Monitoring

* **Site**: every exam the updater has read from its official site shows
  "Official site last checked on <date>" under *Official sources*; the home
  page briefing shows the dataset date.
* **API**: `GET /pipeline/status` on the backend returns the freshness report
  (dataset age, last run, alerting sources, cycles awaiting a new notice).
* **Actions**: each run's step summary lists the changes; the artifact holds
  the per-source log (`http`, `confidence`, `relevant`, `applied`, `error`).
* **Issues**: a failing run opens/updates the `auto-update` issue.

## Adding or fixing a source

Sources live in `backend/seed/curated.json`: a cycle's `links` (Notification →
Apply → Website order) and its body's `notice_urls` / `official_url`. The
updater tries at most three URLs per cycle and stops at the first relevant,
confident page. If a cycle keeps showing up under *Sources failing repeatedly*,
point its Notification link at the current official notice page.

Tests: `backend/tests/test_update_system.py` (network-free; a fake scraper
serves canned HTML into a temporary repo layout).
