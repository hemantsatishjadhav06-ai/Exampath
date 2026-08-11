"""ExamPath auth — zero-dependency (Python standard library) accounts + sessions.

SQLite-backed user store sharing the same backend/exampath.db file the pipeline
mirror writes to; auth creates and owns its own tables (users, sessions) lazily
on first use. Security properties:

  * Passwords are hashed with PBKDF2-HMAC-SHA256 (200,000 iterations) and a
    per-user 16-byte random salt (secrets.token_bytes). Plaintext passwords are
    never stored or logged.
  * Hash comparison uses hmac.compare_digest (constant-time), and the KDF runs
    even for unknown emails so login timing does not reveal account existence.
  * Login failures return a generic "invalid credentials" error — never
    whether the email exists.
  * Session tokens are secrets.token_urlsafe(32) and expire after 7 days;
    expired sessions are rejected and pruned lazily.

Module-level register/login/logout/get_user operate on the default DB
(override with EXAMPATH_AUTH_DB); instantiate AuthService(db_path) directly
for an isolated store (used by tests).
"""
from __future__ import annotations
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]          # .../backend
DEFAULT_DB_PATH = BACKEND / "exampath.db"

PBKDF2_ITERATIONS = 200_000
SALT_BYTES = 16
SESSION_TTL = timedelta(days=7)
MIN_PASSWORD_LEN = 8
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

_SCHEMA = """
create table if not exists users (
    id            integer primary key autoincrement,
    email         text not null unique,
    name          text not null,
    password_hash blob not null,
    salt          blob not null,
    created_at    text not null
);
create table if not exists sessions (
    token      text primary key,
    user_id    integer not null references users(id),
    created_at text not null,
    expires_at text not null
);
"""

# Burned on lookups for unknown emails so the KDF always runs (uniform timing).
_DUMMY_SALT = b"\x00" * SALT_BYTES


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    # Fixed-width ISO-8601 UTC ("2026-08-11T09:00:00+00:00") so stored
    # timestamps compare correctly as strings inside SQLite.
    return dt.isoformat(timespec="seconds")


def hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)


class AuthService:
    """User + session store bound to one SQLite file. Thread-safe: every
    operation opens its own short-lived connection (same style as store.py)."""

    def __init__(self, db_path: str | Path | None = None):
        self.db_path = str(db_path or os.environ.get("EXAMPATH_AUTH_DB") or DEFAULT_DB_PATH)

    # -- internals ---------------------------------------------------------
    def _connect(self) -> sqlite3.Connection:
        con = sqlite3.connect(self.db_path)
        con.executescript(_SCHEMA)  # lazy table creation, idempotent
        return con

    @staticmethod
    def _prune_expired(con: sqlite3.Connection) -> None:
        con.execute("delete from sessions where expires_at <= ?", (_iso(_now()),))
        con.commit()

    @staticmethod
    def _public_user(uid: int, email: str, name: str, created_at: str) -> dict:
        return {"id": uid, "email": email, "name": name, "created_at": created_at}

    # -- API ---------------------------------------------------------------
    def register(self, email: str, password: str, name: str) -> dict:
        email = (email or "").strip().lower()
        name = (name or "").strip()
        if not EMAIL_RE.match(email):
            return {"ok": False, "error": "invalid email address"}
        if not isinstance(password, str) or len(password) < MIN_PASSWORD_LEN:
            return {"ok": False, "error": f"password must be at least {MIN_PASSWORD_LEN} characters"}
        if not name:
            return {"ok": False, "error": "name is required"}

        salt = secrets.token_bytes(SALT_BYTES)
        pw_hash = hash_password(password, salt)
        created = _iso(_now())
        con = self._connect()
        try:
            cur = con.execute(
                "insert into users (email, name, password_hash, salt, created_at) values (?,?,?,?,?)",
                (email, name, pw_hash, salt, created))
            con.commit()
            return {"ok": True, "user": self._public_user(cur.lastrowid, email, name, created)}
        except sqlite3.IntegrityError:
            return {"ok": False, "error": "email already registered"}
        finally:
            con.close()

    def login(self, email: str, password: str) -> dict:
        email = (email or "").strip().lower()
        password = password if isinstance(password, str) else ""
        con = self._connect()
        try:
            row = con.execute(
                "select id, email, name, password_hash, salt, created_at from users where email = ?",
                (email,)).fetchone()
            # Always run the KDF + constant-time compare so failures are
            # uniform whether or not the email exists.
            salt = row[4] if row else _DUMMY_SALT
            stored = row[3] if row else b"\x00" * 32
            candidate = hash_password(password, salt)
            if row is None or not hmac.compare_digest(candidate, stored):
                return {"ok": False, "error": "invalid credentials"}

            token = secrets.token_urlsafe(32)
            now = _now()
            con.execute("insert into sessions (token, user_id, created_at, expires_at) values (?,?,?,?)",
                        (token, row[0], _iso(now), _iso(now + SESSION_TTL)))
            con.commit()
            return {"ok": True, "token": token,
                    "user": self._public_user(row[0], row[1], row[2], row[5])}
        finally:
            con.close()

    def logout(self, token: str) -> bool:
        if not token:
            return False
        con = self._connect()
        try:
            cur = con.execute("delete from sessions where token = ?", (token,))
            con.commit()
            return cur.rowcount > 0
        finally:
            con.close()

    def get_user(self, token: str) -> dict | None:
        if not token:
            return None
        con = self._connect()
        try:
            self._prune_expired(con)  # lazy cleanup of expired sessions
            row = con.execute(
                "select u.id, u.email, u.name, u.created_at, s.expires_at "
                "from sessions s join users u on u.id = s.user_id where s.token = ?",
                (token,)).fetchone()
            if row is None or row[4] <= _iso(_now()):
                return None
            return self._public_user(row[0], row[1], row[2], row[3])
        finally:
            con.close()


# -- module-level default service (backend/exampath.db) ---------------------
_default: AuthService | None = None


def _service() -> AuthService:
    global _default
    if _default is None:
        _default = AuthService()
    return _default


def register(email: str, password: str, name: str) -> dict:
    return _service().register(email, password, name)


def login(email: str, password: str) -> dict:
    return _service().login(email, password)


def logout(token: str) -> bool:
    return _service().logout(token)


def get_user(token: str) -> dict | None:
    return _service().get_user(token)
