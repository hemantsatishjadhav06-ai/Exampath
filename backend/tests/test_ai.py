"""Tests for the OpenRouter client + AI assistant (deterministic offline paths)."""
import json
import unittest
from pathlib import Path

from app.ai.assistant import parse_query, filter_cycles, answer_question, personal_digest
from app.llm.openrouter import OpenRouterClient, OpenRouterError

ROOT = Path(__file__).resolve().parents[2]


def load():
    return json.loads((ROOT / "data" / "exams.json").read_text(encoding="utf-8"))


class TestOpenRouterClient(unittest.TestCase):
    def test_no_key_is_unavailable(self):
        c = OpenRouterClient(api_key="")
        self.assertFalse(c.available)
        with self.assertRaises(OpenRouterError):
            c.chat([{"role": "user", "content": "hi"}])

    def test_key_makes_available(self):
        self.assertTrue(OpenRouterClient(api_key="sk-or-test").available)


class TestAssistant(unittest.TestCase):
    def setUp(self):
        self.data = load()
        self.offline = OpenRouterClient(api_key="")

    def test_parse_query(self):
        f = parse_query("which graduate exams can I give at age 21 in SSC")
        self.assertEqual(f["qualification"], "graduate")
        self.assertEqual(f["age"], 21)
        self.assertEqual(f["body"], "ssc")

    def test_filter_graduate_age21(self):
        ids = {c["id"] for c in filter_cycles(self.data, {"qualification": "graduate", "age": 21})}
        self.assertIn("ssc-cgl-2026", ids)
        self.assertNotIn("ssc-chsl-2026", ids)   # 12th-only excluded

    def test_answer_offline_fallback(self):
        r = answer_question("graduate exams at 21?", self.data, client=self.offline)
        self.assertFalse(r["used_llm"])
        self.assertTrue(r["matches"])
        self.assertIn("exam", r["answer"].lower())

    def test_digest_sorted_and_eligible(self):
        r = personal_digest(self.data, {"age": 21, "qualification": "graduate",
                                        "following": ["ssc-cgl-2026"]}, client=self.offline)
        self.assertTrue(r["items"])
        days = [i["days_left"] for i in r["items"]]
        self.assertEqual(days, sorted(days))


if __name__ == "__main__":
    unittest.main(verbosity=2)
