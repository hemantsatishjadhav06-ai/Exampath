# ExamPath — Copilot repository instructions

ExamPath tracks Indian government exam cycles (vacancies, dates, results) and
publishes a fast static site plus a small JSON/AI API. A sibling product,
MeraSafar (Next.js 14), lives on the `merasafar` branch of this repo.

## Architecture (main branch)

- `web/` — **zero-dependency** static site generator. `web/scripts/site.mjs`
  renders every page (~274 URLs) from `data/exams.json`;
  `web/scripts/export-static.mjs` writes the site, sitemap, robots, RSS
  (`rss.xml`), PWA manifest and service worker into `web/dist`. Builds are
  parameterised by `BASE_PATH` (GitHub Pages serves under `/Exampath/`) and
  `SITE_URL`. Client behaviour is in `web/public/client.js`.
- `backend/` — **Python standard library only** (no pip installs).
  - `app/scrapers/` — `FixtureScraper` (bundled sample notices) and
    `HttpScraper` (live official pages).
  - `app/pipeline/` — scrape → `extract.py` (vacancy/date/release detection)
    → `validate.py` (**cycles publish only above the 90% quality gate**)
    → `store.py` (JSON + SQLite) → `app/publish/supabase_publish.py`.
    Live reconcile (`EXAMPATH_LIVE=1`) only overwrites curated values at
    confidence ≥ 0.6; on any fetch error it keeps the curated value.
  - `app/pipeline/update.py` — the **auto-update tool** (`check` / `apply` /
    `status`): diffs each run against the published data (`changes.py`),
    keeps per-source memory and run history (`state.py`), carries last-good
    live facts forward, refuses regressions, writes `data/changelog.json` +
    `data/update-state.json`. Design notes in `docs/auto-update.md`.
  - `app/api/server.py` — stdlib HTTP API (health, exams, AI Q&A via
    OpenRouter, auth, `/pipeline/run`, `/pipeline/status`).
- `.github/workflows/` — Pages deploy, CI, and the 4×-daily auto data update
  (`scrape-and-publish.yml`: update → commit → deploy → failure issue).
- Deploys: Render (`exampath.onrender.com` static, `exampath-api-cq29`)
  and GitHub Pages mirror. Render deploys track the `main` branch.

## Non-negotiable rules

1. **Data comes from verified official sources only** (government sites in
   `backend/seed/curated.json` links). Never invent exam facts, dates or
   vacancies; never bypass the validation gate. Link to official PDFs —
   **never download and re-host them** (copyright).
2. **No new runtime dependencies** in `web/` or `backend/` — both are
   dependency-free by design; justify any exception in the PR.
3. **Never commit secrets.** API keys (OpenRouter, Render, Supabase
   service-role, pipeline secret) live only in environment variables.
4. Run `python -m unittest discover -q tests` from `backend/` and
   `node web/scripts/export-static.mjs` before pushing; both must pass.
5. Site language is simple English with Hindi where present; the design
   system is the light teal/professional palette — no dark, cluttered UI.
6. Commits: imperative subject, body explains the why; never include model
   or tool identifiers.
