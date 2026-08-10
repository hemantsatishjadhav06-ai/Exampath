"""Publish the processed dataset to Supabase (Postgres) via the PostgREST API.

Zero third-party dependencies — uses the standard library only, so it runs
anywhere the pipeline runs (CI included) without extra installs.

Design
------
* Bodies and cycles are UPSERTED (merge-duplicates on the primary key), so a
  run only ever adds or refreshes rows — the "old" data keeps updating in place.
* Each run also appends an immutable row to `dataset_snapshots`; the website's
  build-time fetch reads the newest one as its single source of truth.
* Writes use the SERVICE-ROLE key (server side, bypasses RLS). Reads work with
  the public/publishable key too. Configuration comes from the environment:

    SUPABASE_URL           e.g. https://xxxx.supabase.co   (required to publish)
    SUPABASE_SERVICE_KEY   service-role key (write)         (required to publish)
    SUPABASE_KEY /
    SUPABASE_ANON_KEY      publishable/anon key (read)      (fallback for reads)

If the URL/key are absent, publishing is a no-op that logs why — the rest of
the pipeline is unaffected.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Optional


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
@dataclass
class SupabaseConfig:
    url: str
    write_key: Optional[str] = None   # service-role (preferred for writes)
    read_key: Optional[str] = None    # anon/publishable (reads)
    timeout: float = 30.0

    @property
    def rest(self) -> str:
        return self.url.rstrip("/") + "/rest/v1"

    @classmethod
    def from_env(cls) -> Optional["SupabaseConfig"]:
        url = os.environ.get("SUPABASE_URL", "").strip()
        if not url:
            return None
        write_key = (
            os.environ.get("SUPABASE_SERVICE_KEY")
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or ""
        ).strip() or None
        read_key = (
            os.environ.get("SUPABASE_KEY")
            or os.environ.get("SUPABASE_ANON_KEY")
            or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
            or ""
        ).strip() or None
        return cls(url=url, write_key=write_key, read_key=read_key)


# --------------------------------------------------------------------------- #
# Payload shaping
# --------------------------------------------------------------------------- #
def build_payloads(dataset: dict) -> dict[str, list[dict[str, Any]]]:
    """Turn a published dataset into row payloads for each table.

    Pure function (no network) so it is unit-testable.
    """
    generated_at = dataset.get("generated_at")
    source = dataset.get("source", "exampath-pipeline")

    bodies = [
        {
            "slug": b["slug"],
            "name": b.get("name"),
            "short": b.get("short"),
            "level": b.get("level"),
            "color": b.get("color", "#1d4ed8"),
            "official_url": b.get("official_url"),
        }
        for b in dataset.get("bodies", [])
    ]

    cycles = []
    for c in dataset.get("cycles", []):
        cycles.append(
            {
                "id": c["id"],
                "body": c.get("body"),
                "exam": c.get("exam"),
                "title": c.get("title"),
                "status": c.get("status"),
                "vacancy": c.get("vacancy"),
                "qualification": c.get("qualification"),
                "qualification_code": c.get("qualification_code"),
                "age_min": c.get("age_min"),
                "age_max": c.get("age_max"),
                "generated_at": generated_at,
                "last_checked": c.get("last_checked"),
                "source_hash": c.get("source_hash"),
                "data": c,
            }
        )

    snapshot = {
        "generated_at": generated_at,
        "source": source,
        "body_count": len(bodies),
        "cycle_count": len(cycles),
        "payload": dataset,
    }
    return {"bodies": bodies, "cycles": cycles, "dataset_snapshots": [snapshot]}


# --------------------------------------------------------------------------- #
# HTTP helpers (stdlib)
# --------------------------------------------------------------------------- #
def _request(
    method: str, url: str, key: str, *, body: Optional[bytes] = None,
    extra_headers: Optional[dict] = None, timeout: float = 30.0,
) -> tuple[int, bytes]:
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:  # 4xx/5xx still carry a useful body
        return e.code, e.read()


def _upsert(cfg: SupabaseConfig, table: str, rows: list[dict],
            on_conflict: Optional[str]) -> None:
    if not rows:
        return
    url = f"{cfg.rest}/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    payload = json.dumps(rows).encode("utf-8")
    status, resp = _request(
        "POST", url, cfg.write_key,
        body=payload,
        extra_headers={
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        timeout=cfg.timeout,
    )
    if status >= 300:
        raise RuntimeError(
            f"Supabase upsert into {table} failed (HTTP {status}): "
            f"{resp.decode('utf-8', 'replace')[:400]}"
        )


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def publish_to_supabase(
    dataset: dict,
    cfg: Optional[SupabaseConfig] = None,
    *,
    log: Optional[list[str]] = None,
) -> bool:
    """Upsert bodies + cycles and append a snapshot. Returns True if published.

    Never raises for a *missing* configuration — it just reports and returns
    False so the pipeline keeps working offline.
    """
    def _note(msg: str) -> None:
        if log is not None:
            log.append(msg)

    cfg = cfg or SupabaseConfig.from_env()
    if cfg is None:
        _note("[supabase] SUPABASE_URL not set — skipping publish (offline mode).")
        return False
    if not cfg.write_key:
        _note("[supabase] no service-role key (SUPABASE_SERVICE_KEY) — "
              "skipping write. Add it as a secret to enable publishing.")
        return False

    payloads = build_payloads(dataset)
    _upsert(cfg, "bodies", payloads["bodies"], on_conflict="slug")
    _upsert(cfg, "cycles", payloads["cycles"], on_conflict="id")
    _upsert(cfg, "dataset_snapshots", payloads["dataset_snapshots"], on_conflict=None)
    _note(f"[supabase] published {len(payloads['bodies'])} bodies + "
          f"{len(payloads['cycles'])} cycles + snapshot -> {cfg.url}")
    return True


def fetch_latest_snapshot(cfg: Optional[SupabaseConfig] = None) -> Optional[dict]:
    """Return the newest published dataset payload, or None if unavailable.

    Uses the read key (publishable/anon is enough thanks to the public-read
    RLS policy). Used by the website's build-time data fetch.
    """
    cfg = cfg or SupabaseConfig.from_env()
    if cfg is None:
        return None
    key = cfg.read_key or cfg.write_key
    if not key:
        return None
    url = (f"{cfg.rest}/dataset_snapshots"
           "?select=payload&order=created_at.desc&limit=1")
    status, resp = _request("GET", url, key, timeout=cfg.timeout)
    if status >= 300:
        return None
    try:
        rows = json.loads(resp.decode("utf-8"))
    except json.JSONDecodeError:
        return None
    if not rows:
        return None
    return rows[0].get("payload")


if __name__ == "__main__":  # tiny manual smoke: python -m app.publish.supabase_publish
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[3]
    data = json.loads((root / "data" / "exams.json").read_text("utf-8"))
    logs: list[str] = []
    ok = publish_to_supabase(data, log=logs)
    print("\n".join(logs))
    sys.exit(0 if ok or "--allow-skip" in sys.argv else 1)
