"""Tests for the live-reconcile extractor and the Supabase publisher.

Network-free: the publisher's HTTP layer is never exercised here — only the
pure payload/So config/graceful-skip behaviour, so these run anywhere.
"""
import os
import unittest

from app.pipeline.extract import extract_generic
from app.pipeline.run import notice_url, _merge_dates
from app.publish.supabase_publish import (
    SupabaseConfig,
    build_payloads,
    publish_to_supabase,
    fetch_latest_snapshot,
)


SAMPLE_HTML = """
<html><body>
  <h1>Recruitment 2026</h1>
  <p>Total Vacancies: 12,345 posts across India.</p>
  <table>
    <tr><td>Last date to apply</td><td>19/08/2026</td></tr>
    <tr><td>Exam date</td><td>2026-11-05</td></tr>
  </table>
</body></html>
"""


class GenericExtractTests(unittest.TestCase):
    def test_pulls_vacancy_and_dates_with_confidence(self):
        out = extract_generic(SAMPLE_HTML)
        self.assertEqual(out["vacancy"], 12345)
        labels = {d["label"]: d["date"] for d in out["dates"]}
        self.assertEqual(labels.get("Last date to apply"), "2026-08-19")
        self.assertEqual(labels.get("Exam date"), "2026-11-05")
        self.assertGreaterEqual(out["confidence"], 0.6)

    def test_empty_page_is_low_confidence(self):
        out = extract_generic("<html><body>Hello</body></html>")
        self.assertIsNone(out["vacancy"])
        self.assertLess(out["confidence"], 0.6)


class ReconcileHelperTests(unittest.TestCase):
    def test_notice_url_prefers_notification_link(self):
        cycle = {
            "body": "ssc",
            "links": [
                {"kind": "Website", "url": "https://ssc.gov.in"},
                {"kind": "Notification", "url": "https://ssc.gov.in/notice.pdf"},
            ],
        }
        self.assertEqual(notice_url(cycle, {}), "https://ssc.gov.in/notice.pdf")

    def test_notice_url_falls_back_to_body(self):
        cycle = {"body": "upsc", "links": []}
        bodies = {"upsc": {"official_url": "https://upsc.gov.in"}}
        self.assertEqual(notice_url(cycle, bodies), "https://upsc.gov.in")

    def test_merge_dates_updates_by_label(self):
        merged = _merge_dates(
            [{"label": "Last date to apply", "date": "2026-08-19", "is_deadline": True}],
            [{"label": "Last date to apply", "date": "2026-08-25", "is_deadline": True}],
        )
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["date"], "2026-08-25")


class SupabasePayloadTests(unittest.TestCase):
    DATASET = {
        "generated_at": "2026-08-10",
        "source": "exampath-pipeline",
        "bodies": [{"slug": "ssc", "name": "Staff Selection Commission", "short": "SSC"}],
        "cycles": [{
            "id": "ssc-cgl-2026", "body": "ssc", "exam": "SSC CGL",
            "title": "SSC CGL 2026", "status": "closing_soon", "vacancy": 17727,
            "qualification": "Graduate", "qualification_code": "graduate",
            "age_min": 18, "age_max": 32,
        }],
    }

    def test_build_payloads_shape(self):
        p = build_payloads(self.DATASET)
        self.assertEqual(len(p["bodies"]), 1)
        self.assertEqual(len(p["cycles"]), 1)
        self.assertEqual(len(p["dataset_snapshots"]), 1)
        self.assertEqual(p["cycles"][0]["id"], "ssc-cgl-2026")
        # full record preserved in the jsonb column
        self.assertEqual(p["cycles"][0]["data"]["vacancy"], 17727)
        self.assertEqual(p["dataset_snapshots"][0]["cycle_count"], 1)
        self.assertEqual(p["dataset_snapshots"][0]["payload"], self.DATASET)


class SupabaseConfigTests(unittest.TestCase):
    def setUp(self):
        self._saved = {k: os.environ.get(k) for k in
                       ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_KEY")}
        for k in self._saved:
            os.environ.pop(k, None)

    def tearDown(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_from_env_none_without_url(self):
        self.assertIsNone(SupabaseConfig.from_env())

    def test_publish_skips_without_config(self):
        logs = []
        self.assertFalse(publish_to_supabase(self.dataset(), log=logs))
        self.assertTrue(any("skipping" in m for m in logs))

    def test_publish_skips_without_write_key(self):
        os.environ["SUPABASE_URL"] = "https://example.supabase.co"
        logs = []
        self.assertFalse(publish_to_supabase(self.dataset(), log=logs))
        self.assertTrue(any("service-role" in m for m in logs))

    def test_fetch_snapshot_none_offline(self):
        self.assertIsNone(fetch_latest_snapshot())

    @staticmethod
    def dataset():
        return {"generated_at": "2026-08-10", "source": "x", "bodies": [], "cycles": []}


if __name__ == "__main__":
    unittest.main()
