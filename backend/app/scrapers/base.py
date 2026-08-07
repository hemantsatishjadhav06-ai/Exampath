"""Base scraper primitives: fetch result + content hashing for change detection."""
from __future__ import annotations
import hashlib
from dataclasses import dataclass


@dataclass
class FetchResult:
    url: str
    html: str
    status: int
    content_hash: str
    changed: bool = True


def content_hash(text: str) -> str:
    """Stable sha256 of normalised content — used to detect whether a source changed."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


class BaseScraper:
    """Interface every scraper implements."""

    def fetch(self, url: str) -> FetchResult:  # pragma: no cover - interface
        raise NotImplementedError
