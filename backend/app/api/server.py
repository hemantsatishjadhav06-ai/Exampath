"""ExamPath API — zero-dependency (Python standard library) HTTP server.

Serves published data to the web app during development and exposes the webhook
that n8n will call later ("add n8n later from webhook"). Runs anywhere with no
pip install. (FastAPI is an easy drop-in alternative if you prefer — see README.)

Run:  python -m app.api.server 8000      (from the backend/ directory)
"""
from __future__ import annotations
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data" / "exams.json"
WEBHOOK_SECRET = os.environ.get("N8N_WEBHOOK_SECRET", "changeme")


def load_data() -> dict:
    return json.loads(DATA.read_text(encoding="utf-8")) if DATA.exists() else {"bodies": [], "cycles": []}


def process_webhook(payload: dict, provided_secret: str, secret: str | None = None):
    """Pure, testable webhook logic. Returns (http_status, response_dict).

    n8n posts a scraped document / trigger here with the shared secret. We verify it;
    the caller then kicks off pipeline processing on success.
    """
    secret = WEBHOOK_SECRET if secret is None else secret
    if provided_secret != secret:
        return 401, {"ok": False, "error": "invalid webhook secret"}
    return 200, {"ok": True, "received_keys": sorted(payload.keys())}


class Handler(BaseHTTPRequestHandler):
    def _cors_headers(self):
        origin = self.headers.get("Origin")
        self.send_header("Access-Control-Allow-Origin", origin or "*")
        if origin:
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _send(self, code: int, obj: dict):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _bearer_token(self) -> str:
        scheme, _, token = self.headers.get("Authorization", "").partition(" ")
        return token.strip() if scheme.lower() == "bearer" else ""

    def do_OPTIONS(self):  # CORS preflight
        self.send_response(204)
        self._cors_headers()
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path in ("", "/"):
            return self._send(200, {
                "ok": True, "service": "exampath-api",
                "site": "https://exampath.onrender.com/",
                "endpoints": [
                    "GET /health", "GET /pipeline/status", "GET /api/exams", "GET /api/exams/{id}",
                    "GET /ai/status", "POST /ai/ask", "POST /ai/path", "POST /ai/digest",
                    "POST /auth/register", "POST /auth/login", "GET /auth/me",
                ],
            })
        if self.path == "/health":
            return self._send(200, {"ok": True, "service": "exampath-api"})
        if self.path == "/pipeline/status":
            # Freshness of the published data + the auto-updater's last runs.
            # Public and read-only: lets the site, monitors and humans see
            # when facts were last refreshed and which sources are failing.
            from ..pipeline.update import status
            return self._send(200, {"ok": True, **status()})
        if self.path == "/api/exams":
            return self._send(200, load_data())
        if self.path.startswith("/api/exams/"):
            cid = self.path.rsplit("/", 1)[-1]
            for c in load_data().get("cycles", []):
                if c["id"] == cid:
                    return self._send(200, c)
            return self._send(404, {"error": "not found"})
        if self.path == "/ai/status":
            from ..llm.openrouter import OpenRouterClient
            c = OpenRouterClient()
            return self._send(200, {"llm_available": c.available, "model": c.model})
        if self.path == "/auth/me":
            from ..auth import get_user
            user = get_user(self._bearer_token())
            if user is None:
                return self._send(401, {"ok": False, "error": "invalid or expired token"})
            return self._send(200, {"ok": True, "user": user})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw or b"{}")
        except Exception:
            payload = {}

        if self.path == "/pipeline/run":
            # Optional guard: when PIPELINE_RUN_SECRET is set, callers must
            # present it — the run triggers outbound scrapes of official sites.
            secret = os.environ.get("PIPELINE_RUN_SECRET", "")
            if secret and self.headers.get("x-pipeline-secret", "") != secret:
                return self._send(401, {"ok": False, "error": "invalid pipeline secret"})
            from ..pipeline.run import run
            sink: list[str] = []
            ds = run(verbose=False, log_sink=sink)
            return self._send(200, {
                "ok": True,
                "published_cycles": len(ds["cycles"]),
                "generated_at": ds["generated_at"],
                "log": sink,
            })

        if self.path == "/webhook/n8n":
            code, resp = process_webhook(payload, self.headers.get("x-webhook-secret", ""))
            if code == 200:
                from ..pipeline.run import run
                threading.Thread(target=run, kwargs={"verbose": False}, daemon=True).start()
            return self._send(code, resp)

        if self.path == "/ai/ask":
            from ..ai.assistant import answer_question
            return self._send(200, answer_question(payload.get("question", ""), load_data()))

        if self.path == "/ai/path":
            # Guided self-discovery: profile in, full recommended process out.
            from ..ai.pathfinder import plan_path
            return self._send(200, plan_path(load_data(), payload))

        if self.path == "/ai/digest":
            from ..ai.assistant import personal_digest
            return self._send(200, personal_digest(load_data(), payload))

        if self.path == "/auth/register":
            from ..auth import register
            res = register(payload.get("email", ""), payload.get("password", ""),
                           payload.get("name", ""))
            return self._send(201 if res["ok"] else 400, res)

        if self.path == "/auth/login":
            from ..auth import login
            res = login(payload.get("email", ""), payload.get("password", ""))
            return self._send(200 if res["ok"] else 401, res)

        if self.path == "/auth/logout":
            from ..auth import logout
            return self._send(200, {"ok": logout(self._bearer_token())})

        self._send(404, {"error": "not found"})

    def log_message(self, *args):  # silence default logging
        pass


def serve(port: int = 8000):
    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"ExamPath API listening on http://0.0.0.0:{port}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()


if __name__ == "__main__":
    import sys
    # Port precedence: CLI arg > $PORT (Render/most hosts) > 8000
    serve(int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8000")))
