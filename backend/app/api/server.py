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
    def _send(self, code: int, obj: dict):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "service": "exampath-api"})
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
        self._send(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw or b"{}")
        except Exception:
            payload = {}

        if self.path == "/pipeline/run":
            from ..pipeline.run import run
            ds = run(verbose=False)
            return self._send(200, {"ok": True, "published_cycles": len(ds["cycles"])})

        if self.path == "/webhook/n8n":
            code, resp = process_webhook(payload, self.headers.get("x-webhook-secret", ""))
            if code == 200:
                from ..pipeline.run import run
                threading.Thread(target=run, kwargs={"verbose": False}, daemon=True).start()
            return self._send(code, resp)

        if self.path == "/ai/ask":
            from ..ai.assistant import answer_question
            return self._send(200, answer_question(payload.get("question", ""), load_data()))

        if self.path == "/ai/digest":
            from ..ai.assistant import personal_digest
            return self._send(200, personal_digest(load_data(), payload))

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
    serve(int(sys.argv[1]) if len(sys.argv) > 1 else 8000)
