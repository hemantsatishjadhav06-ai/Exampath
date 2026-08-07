"""Tests for the scrape -> extract -> validate -> publish pipeline + API.

Runs on the standard library:  python -m unittest -v   (from backend/)
"""
import json
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path

from app.pipeline.extract import extract_from_html
from app.pipeline.validate import validate_cycle
from app.pipeline.run import run
from app.api.server import process_webhook, Handler, ThreadingHTTPServer

BACKEND = Path(__file__).resolve().parents[1]


class TestExtraction(unittest.TestCase):
    def test_ssc_notice(self):
        ext = extract_from_html((BACKEND / "sources" / "ssc-cgl.html").read_text(encoding="utf-8"))
        self.assertEqual(ext["vacancy"], 17727)
        self.assertEqual((ext["age_min"], ext["age_max"]), (18, 32))
        self.assertTrue(ext["qualification"].lower().startswith("grad"))
        self.assertTrue(any(d["is_deadline"] for d in ext["dates"]))
        self.assertGreaterEqual(ext["confidence"], 0.8)

    def test_ibps_notice(self):
        ext = extract_from_html((BACKEND / "sources" / "ibps-po.html").read_text(encoding="utf-8"))
        self.assertEqual(ext["vacancy"], 4455)
        self.assertEqual((ext["age_min"], ext["age_max"]), (20, 30))


class TestValidationGate(unittest.TestCase):
    def test_good_cycle_passes(self):
        good = {
            "id": "x-2026", "body": "ssc", "exam": "X", "title": "X 2026",
            "status": "application_open", "vacancy": 100, "age_min": 18, "age_max": 30,
            "dates": [{"label": "Last Date", "date": "2026-08-19", "is_deadline": True}],
            "links": [{"label": "Notif", "url": "https://ssc.gov.in", "kind": "Notification"}],
        }
        v = validate_cycle(good)
        self.assertTrue(v["passed"])
        self.assertGreaterEqual(v["score"], 90)

    def test_bad_cycle_blocked(self):
        bad = {
            "id": "y", "body": "", "exam": "", "title": "", "status": "",
            "vacancy": 0, "age_min": 40, "age_max": 20,
            "dates": [{"label": "d", "date": "not-a-date"}], "links": [],
        }
        v = validate_cycle(bad)
        self.assertFalse(v["passed"])
        self.assertLess(v["score"], 90)


class TestPipelineEndToEnd(unittest.TestCase):
    def test_run_publishes(self):
        out = Path(tempfile.mkdtemp()) / "exams.json"
        ds = run(export_path=str(out), verbose=False)
        self.assertTrue(out.exists())
        data = json.loads(out.read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(data["cycles"]), 5)
        self.assertEqual(len(data["bodies"]), 5)
        self.assertIn("ssc-cgl-2026", {c["id"] for c in data["cycles"]})
        ssc = next(c for c in data["cycles"] if c["id"] == "ssc-cgl-2026")
        self.assertEqual(ssc["vacancy"], 17727)  # reconciled from the scraped notice


class TestWebhook(unittest.TestCase):
    def test_secret_required(self):
        code, _ = process_webhook({"a": 1}, "wrong", secret="right")
        self.assertEqual(code, 401)

    def test_secret_ok(self):
        code, resp = process_webhook({"doc": 1, "trigger": 2}, "right", secret="right")
        self.assertEqual(code, 200)
        self.assertEqual(resp["received_keys"], ["doc", "trigger"])


class TestServer(unittest.TestCase):
    def test_health_and_exams(self):
        srv = ThreadingHTTPServer(("127.0.0.1", 8899), Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            time.sleep(0.2)
            health = json.loads(urllib.request.urlopen("http://127.0.0.1:8899/health", timeout=3).read())
            self.assertTrue(health["ok"])
            exams = json.loads(urllib.request.urlopen("http://127.0.0.1:8899/api/exams", timeout=3).read())
            self.assertIn("cycles", exams)
        finally:
            srv.shutdown()


if __name__ == "__main__":
    unittest.main(verbosity=2)
