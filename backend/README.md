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
