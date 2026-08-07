"""Storage: export the published dataset to JSON (consumed by the web app) and SQLite.

In production the same `upsert` writes to Supabase/Postgres via the service-role key;
here we keep a zero-config SQLite mirror + the JSON snapshot the frontend builds from.
"""
from __future__ import annotations
import json
import sqlite3
from pathlib import Path


def export_json(dataset: dict, path: str | Path) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dataset, indent=2, ensure_ascii=False), encoding="utf-8")


def save_sqlite(dataset: dict, db_path: str | Path) -> None:
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    cur.execute("create table if not exists body (slug text primary key, name text, json text)")
    cur.execute("create table if not exists cycle (id text primary key, body text, title text, "
                "status text, vacancy integer, json text)")
    for b in dataset["bodies"]:
        cur.execute("insert or replace into body values (?,?,?)",
                    (b["slug"], b["name"], json.dumps(b, ensure_ascii=False)))
    for c in dataset["cycles"]:
        cur.execute("insert or replace into cycle values (?,?,?,?,?,?)",
                    (c["id"], c["body"], c["title"], c["status"], c["vacancy"],
                     json.dumps(c, ensure_ascii=False)))
    con.commit()
    con.close()
