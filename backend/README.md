# ExamPath — Backend (scraping + automation)

Python service that scrapes official exam notices, extracts structured data with an
AI/rule-based extractor, validates it through a **> 90% confidence gate**, and publishes
the result to `data/exams.json` (consumed by the web app) plus a SQLite mirror.

## Run

```bash
cd backend
pip install -r requirements.txt      # httpx, beautifulsoup4, lxml, pydantic
python -m app.pipeline.run           # scrape -> extract -> validate -> publish
python -m app.api.server 8000        # API + n8n webhook  (http://localhost:8000)
python -m unittest -v                # tests (standard library, no pytest needed)
```

> The API runs on the Python standard library (no FastAPI/uvicorn required). To use
> FastAPI instead, uncomment it in `requirements.txt` and adapt `app/api/server.py`.

## Pipeline

```
scrape (app/scrapers) -> extract (app/pipeline/extract.py)
   -> validate (app/pipeline/validate.py  ← the >90% gate)
   -> store/publish (app/pipeline/store.py -> ../data/exams.json + exampath.db)
```

- Swap `FixtureScraper` for `HttpScraper` (point at real URLs) to go live against official sites.
- Connect an LLM in `pipeline/extract.py::LLMExtractor` for messy PDFs/HTML.

## n8n (add later, via webhook)

n8n will `POST /webhook/n8n` with header `x-webhook-secret: $N8N_WEBHOOK_SECRET`,
carrying a scraped document or a trigger. The endpoint verifies the secret and runs the
pipeline in the background.

Endpoints (`app/api/server.py`): `GET /health` · `GET /api/exams` ·
`GET /api/exams/{id}` · `POST /pipeline/run` · `POST /webhook/n8n`
(header `x-webhook-secret: $N8N_WEBHOOK_SECRET`).

## AI features (OpenRouter)

The standout backend features run on **OpenRouter** (one key for any model — set
`OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL`). Everything degrades gracefully to
deterministic logic when no key is set, so the API always works.

- `GET  /ai/status` → `{llm_available, model}`
- `POST /ai/ask`    `{ "question": "which graduate exams can I give at 21?" }`
  → a concise, **retrieval-grounded** answer (only from our data) + the matching exam ids.
- `POST /ai/digest` `{ "age": 21, "qualification": "graduate", "following": ["ssc-cgl-2026"] }`
  → a personalised, urgency-sorted list of your upcoming deadlines + a 2-line nudge.
- AI extraction: `LLMExtractor` (in `pipeline/extract.py`) uses OpenRouter for messy
  PDFs/HTML, returning the same JSON shape as the rule-based extractor.

```bash
curl -s localhost:8000/ai/ask -H 'Content-Type: application/json' \
     -d '{"question":"bank exams for graduates closing soon"}' | python3 -m json.tool
```
