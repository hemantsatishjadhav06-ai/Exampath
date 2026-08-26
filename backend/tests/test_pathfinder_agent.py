"""Tests for the Path Finder and the self-updating guidance agent.

Network-free: the LLM is never called (no key in tests -> deterministic path).
"""
import unittest
from datetime import date

from app.ai.agent import reconcile_status, run_agent
from app.ai.pathfinder import build_steps, normalise, plan_path, score_cycles

TODAY = date(2026, 8, 26)

DATASET = {
    "bodies": [{"slug": "rrb", "level": "Railways"}, {"slug": "ssc", "level": "Central"}],
    "cycles": [
        {   # open, closing in 10 days, 10th pass
            "id": "rrb-gd-2026", "title": "RRB Group D 2026", "body": "rrb", "status": "upcoming",
            "qualification": "10th pass", "qualification_code": "10th", "age_min": 18, "age_max": 33,
            "vacancy": 32000,
            "dates": [{"label": "Last date to apply", "date": "2026-09-05", "is_deadline": True},
                      {"label": "Exam date", "date": "2026-11-10"}],
        },
        {   # graduate-only: a 12th-pass student must never see this
            "id": "upsc-cse-2026", "title": "UPSC CSE 2026", "body": "upsc", "status": "upcoming",
            "qualification": "Graduate", "qualification_code": "graduate", "age_min": 21, "age_max": 32,
            "dates": [{"label": "Exam date", "date": "2026-10-01"}],
        },
        {   # every date in the past -> needs a fresh official notification
            "id": "old-2025", "title": "Old Exam 2025", "body": "ssc", "status": "closing_soon",
            "qualification": "12th pass", "qualification_code": "12th", "age_min": 18, "age_max": 30,
            "dates": [{"label": "Last date to apply", "date": "2025-01-01", "is_deadline": True}],
        },
    ],
}


class NormaliseTests(unittest.TestCase):
    def test_free_text_fills_missing_answers(self):
        p = normalise({"query": "12th pass railway job age 21"})
        self.assertEqual(p["education"], "12th")
        self.assertEqual(p["age"], 21)
        self.assertEqual(p["interest"], "railway")

    def test_explicit_answers_win_and_bad_values_drop(self):
        p = normalise({"education": "graduate", "age": "not a number", "interest": "nonsense"})
        self.assertEqual(p["education"], "graduate")
        self.assertIsNone(p["age"])
        self.assertIsNone(p["interest"])


class ScoringTests(unittest.TestCase):
    def test_ineligible_by_qualification_is_excluded(self):
        ids = [m["id"] for m in score_cycles(DATASET, normalise({"education": "12th"}))]
        self.assertIn("rrb-gd-2026", ids)
        self.assertNotIn("upsc-cse-2026", ids)   # graduate-only

    def test_ineligible_by_age_is_excluded(self):
        ids = [m["id"] for m in score_cycles(DATASET, normalise({"age": 45}))]
        self.assertEqual(ids, [])

    def test_interest_lifts_the_matching_exam_to_the_top(self):
        matches = score_cycles(DATASET, normalise({"education": "12th", "interest": "railway"}))
        self.assertEqual(matches[0]["id"], "rrb-gd-2026")
        self.assertIn("railway", matches[0]["why"])


class StepsTests(unittest.TestCase):
    def test_steps_are_grouped_into_dated_horizons(self):
        matches = score_cycles(DATASET, normalise({"education": "12th", "interest": "railway"}))
        steps = build_steps(matches)
        self.assertTrue(steps)
        self.assertIn(steps[0]["when"], ("This week", "This month", "Next 3 months", "Later"))
        self.assertTrue(steps[0]["items"])


class PlanTests(unittest.TestCase):
    def test_plan_is_complete_without_an_llm(self):
        out = plan_path(DATASET, {"education": "12th", "interest": "railway"})
        self.assertTrue(out["ok"])
        self.assertFalse(out["used_llm"])
        self.assertTrue(out["summary"])
        self.assertTrue(out["matches"])

    def test_empty_profile_still_returns_a_plan(self):
        out = plan_path(DATASET, {})
        self.assertTrue(out["ok"])
        self.assertGreaterEqual(out["total_eligible"], 1)


class AgentTests(unittest.TestCase):
    def test_open_window_becomes_closing_soon(self):
        r = reconcile_status(DATASET["cycles"][0], TODAY)
        self.assertEqual(r["status"], "closing_soon")   # 10 days out
        self.assertEqual(r["action"], "apply")
        self.assertEqual(r["days_left"], 10)

    def test_all_dates_past_is_flagged_for_refresh(self):
        r = reconcile_status(DATASET["cycles"][2], TODAY)
        self.assertTrue(r["needs_refresh"])
        self.assertEqual(r["action"], "watch")

    def test_run_agent_corrects_status_and_writes_guidance(self):
        data = {"bodies": DATASET["bodies"], "cycles": [dict(c) for c in DATASET["cycles"]]}
        rep = run_agent(data, TODAY)
        self.assertIn({"id": "rrb-gd-2026", "from": "upcoming", "to": "closing_soon"}, rep["corrections"])
        self.assertIn("old-2025", rep["stale"])
        for c in data["cycles"]:
            self.assertIn("ai_next", c)
            self.assertTrue(c["ai_next"]["headline"])
        self.assertIn("headline", data["ai_briefing"])
        self.assertEqual(data["ai_briefing"]["urgent"][0]["id"], "rrb-gd-2026")

    def test_agent_never_invents_a_date(self):
        data = {"bodies": [], "cycles": [{"id": "x", "title": "X", "status": "upcoming", "dates": []}]}
        run_agent(data, TODAY)
        self.assertTrue(data["cycles"][0]["ai_next"]["needs_refresh"])
        self.assertIsNone(data["cycles"][0]["ai_next"]["days_left"])


if __name__ == "__main__":
    unittest.main()
