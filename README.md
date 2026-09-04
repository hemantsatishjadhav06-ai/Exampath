<div align="center">

# ExamPath

**Every government exam. Every date. One place.**

An AI-automated information portal for Indian government exams — notifications, deadlines,
vacancies, eligibility, cut-offs and results, scraped from official sources, verified through a
confidence gate, and published to a fast, mobile-first website for students.

</div>

---

## What's in here

```
exampath/
├── backend/     Python — scraping + automation pipeline + API/webhook (n8n later)
├── web/         Next.js 14 (App Router, TS, Tailwind) — the student website
├── data/        exams.json — the published dataset the web app builds from
├── scripts/     helpers (push-to-github, etc.)
└── .github/     CI + one-click GitHub Pages deploy
```

- **Backend** scrapes official notices → an AI/rule extractor turns them into structured data →
  a **> 90% validation gate** decides what's trustworthy → the result is published to
  `data/exams.json` (+ a SQLite mirror). Runs on the Python standard library.
- **Frontend** is a real Next.js codebase that renders that data into the student experience
  (home, exam dashboards with live countdowns & an eligibility checker, conducting-body pages,
  search, calendar). It also ships a **zero-dependency static build** so it deploys anywhere.
- **n8n** is added later via a webhook (`POST /webhook/n8n`) — the seam is already in place.

## Architecture

```
   Official sites/PDFs                     ┌─────────────────────────┐
        │  (scrape)                        │   Next.js web app       │
        ▼                                  │   (static export)       │
  ┌──────────────┐   extract   ┌────────┐  │   reads data/exams.json │
  │  scrapers/   │───────────▶ │ AI +   │  └───────────▲─────────────┘
  │  (httpx/BS4) │             │ rules  │              │ publish
  └──────────────┘             └───┬────┘              │
        ▲                          │ validate (>90% gate)
        │ (n8n later,              ▼                    │
        │  via webhook)     ┌─────────────┐   store     │
   POST /webhook/n8n ─────▶ │  pipeline   │────────────▶ data/exams.json (+ SQLite)
                            └─────────────┘
```

## Quick start

```bash
# 1) Backend — run the pipeline + API (Python 3.11, standard library)
cd backend
pip install -r requirements.txt          # httpx, beautifulsoup4, lxml, pydantic
python -m app.pipeline.run               # scrape → extract → validate → publish
python -m app.api.server 8000            # API + n8n webhook at http://localhost:8000
python -m unittest discover -s tests -t . -v   # tests (81, all green)

# 2) Frontend — build the static site (no npm install needed for the zero-dep build)
cd ../web
npm run build                            # → web/out/  (static site)
npm run dev                              # preview at http://localhost:3000
npm run test:e2e                         # Playwright e2e (19, all green)
```

> The web app also has the full Next.js toolchain wired up: in an environment with npm
> registry access, run `npm install` then `npm run build:next` / `npm run dev:next`.

## Keeping the data current (auto-update)

The site refreshes itself. Four times a day a GitHub Actions workflow runs the
auto-update tool against the official sources, and only when a fact changed
(vacancy, a date, a new notice) does it commit the new dataset, publish to
Supabase, rebuild and deploy — with a public changelog (`/changelog.json`) and
"Official site last checked on …" provenance on every refreshed exam page.

```bash
cd backend
python -m app.pipeline.update check --live    # dry run: what WOULD change?
python -m app.pipeline.update apply --live    # refresh data + changelog + state
python -m app.pipeline.update status          # freshness health (exit 1 if stale)
```

Design, safety rules and monitoring: **[docs/auto-update.md](docs/auto-update.md)**.

## Deploy → get a live URL

See **[DEPLOY.md](DEPLOY.md)**. Fastest path: deploy the static build (`web/out`) to Netlify,
Vercel, Cloudflare Pages or GitHub Pages — build command `node scripts/export-static.mjs`
(in `web/`), publish directory `web/out`.

## Roadmap

Wire the scraper to live official URLs (`HttpScraper`) · connect an LLM for messy PDFs
(`pipeline/extract.py::LLMExtractor`) · add n8n for orchestration via the webhook · move the
store from SQLite/JSON to Supabase/Postgres. The database schema and full product blueprint
live in the companion documents.

## Disclaimer

ExamPath aggregates and links to official information; it is **not** a government website.
Always verify on the official source before acting. Sample data in this repo is illustrative.

## License

MIT — see [LICENSE](LICENSE).
