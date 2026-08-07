"""Concrete scrapers.

FixtureScraper  -> reads local sample notices (deterministic; used in tests/demo).
HttpScraper     -> fetches live official pages (production; polite defaults).

Both return a FetchResult so the pipeline is identical regardless of source.
Swap FixtureScraper for HttpScraper (or point HttpScraper at real URLs) to go live.
"""
from __future__ import annotations
from pathlib import Path

import httpx

from .base import BaseScraper, FetchResult, content_hash


class FixtureScraper(BaseScraper):
    """Reads sample official notices from a local folder. `url` is a filename."""

    def __init__(self, base_dir: str | Path):
        self.base = Path(base_dir)

    def fetch(self, url: str) -> FetchResult:
        path = self.base / url
        html = path.read_text(encoding="utf-8")
        return FetchResult(url=url, html=html, status=200, content_hash=content_hash(html))


class HttpScraper(BaseScraper):
    """Polite HTTP fetcher for real official pages/PDF landing pages.

    - custom User-Agent, timeout, redirects
    - in-memory change detection via content hash (persist to the `source` table in prod)
    """

    def __init__(self, timeout: float = 20.0,
                 user_agent: str = "ExamPathBot/1.0 (+https://exampath.example/bot)"):
        self.timeout = timeout
        self.ua = user_agent
        self._seen: dict[str, str] = {}

    def fetch(self, url: str) -> FetchResult:
        resp = httpx.get(url, headers={"User-Agent": self.ua},
                         timeout=self.timeout, follow_redirects=True)
        h = content_hash(resp.text)
        changed = self._seen.get(url) != h
        self._seen[url] = h
        return FetchResult(url=url, html=resp.text, status=resp.status_code,
                           content_hash=h, changed=changed)
