"""Tests for the auto-update system: change detection, update state, the
check/apply/status tool and its safety guards.

Network-free: live fetches go through a fake scraper that serves canned HTML,
and every file write happens inside a temporary repo layout.
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
from datetime import date, datetime, timezone, timedelta
from pathlib import Path

from app.pipeline.changes import (Change, diff_datasets, changes_to_feed_rows, merge_feed_rows,
                                  append_changelog, load_changelog, describe, to_markdown,
                                  MAX_UPDATES_PER_CYCLE)
from app.pipeline.state import (empty_state, record_sources, record_run, alerting_sources,
                                load_state, save_state, MAX_RUNS)
from app.pipeline import update as upd
from app.pipeline.run import _merge_dates, exam_keywords, page_mentions, focus_text, reconcile_live
from app.scrapers.base import FetchResult, content_hash

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent


def _cycle(**over):
    base = {"id": "x-2026", "body": "ssc", "exam": "X", "title": "X 2026",
            "status": "application_open", "vacancy": 100, "age_min": 18, "age_max": 30,
            "dates": [{"label": "Last Date to Apply", "date": "2026-08-19", "is_deadline": True}],
            "links": [{"label": "Notif", "url": "https://ssc.gov.in", "kind": "Notification"}],
            "updates": []}
    base.update(over)
    return base


class DiffTests(unittest.TestCase):
    def test_no_changes_when_identical(self):
        ds = {"cycles": [_cycle()]}
        self.assertEqual(diff_datasets(ds, json.loads(json.dumps(ds))), [])

    def test_ignores_bookkeeping_fields(self):
        a = {"cycles": [_cycle()]}
        b = {"cycles": [_cycle(last_checked="2026-09-04T00:00:00", source_hash="abc",
                               ai_next={"x": 1})]}
        self.assertEqual(diff_datasets(a, b), [])

    def test_detects_vacancy_and_date_changes(self):
        a = {"cycles": [_cycle()]}
        b = {"cycles": [_cycle(vacancy=120, dates=[
            {"label": "Last Date to Apply", "date": "2026-08-25", "is_deadline": True},
            {"label": "Exam date", "date": "2026-11-05", "is_deadline": False}])]}
        ch = diff_datasets(a, b)
        fields = {c.field: (c.old, c.new) for c in ch}
        self.assertEqual(fields["vacancy"], (100, 120))
        self.assertEqual(fields["dates.Last Date to Apply"], ("2026-08-19", "2026-08-25"))
        self.assertEqual(fields["dates.Exam date"], (None, "2026-11-05"))

    def test_added_and_removed_cycles(self):
        a = {"cycles": [_cycle(id="a"), _cycle(id="b")]}
        b = {"cycles": [_cycle(id="b"), _cycle(id="c")]}
        kinds = {(c.cycle, c.kind) for c in diff_datasets(a, b)}
        self.assertEqual(kinds, {("a", "removed"), ("c", "added")})

    def test_first_run_has_no_previous(self):
        ch = diff_datasets(None, {"cycles": [_cycle()]})
        self.assertEqual([c.kind for c in ch], ["added"])

    def test_describe_is_plain_english(self):
        self.assertIn("100 → 1,200", describe(Change("x", "changed", "vacancy", 100, 1200)))
        self.assertIn("19 Aug 2026 → 25 Aug 2026",
                      describe(Change("x", "changed", "dates.Last Date to Apply", "2026-08-19", "2026-08-25")))
        self.assertIn("No material", to_markdown([]))


class FeedRowTests(unittest.TestCase):
    def test_rows_carry_published_at_and_dedupe(self):
        ch = [Change("x-2026", "changed", "vacancy", 100, 120),
              Change("x-2026", "changed", "status", "upcoming", "admit_card")]   # status: not feed-worthy
        rows = changes_to_feed_rows(ch, today=date(2026, 9, 4))
        self.assertEqual(len(rows["x-2026"]), 1)
        self.assertEqual(rows["x-2026"][0]["published_at"], "2026-09-04")
        ds = {"cycles": [_cycle(updates=[{"text": "old", "kind": "info", "when": "3d ago"}])]}
        self.assertEqual(merge_feed_rows(ds, rows), 1)
        self.assertEqual(merge_feed_rows(ds, rows), 0)          # second merge is a no-op
        self.assertEqual(ds["cycles"][0]["updates"][0]["kind"], "info")
        self.assertTrue(ds["cycles"][0]["updates"][0]["text"].startswith("Vacancies updated"))

    def test_feed_is_capped(self):
        ds = {"cycles": [_cycle(updates=[{"text": f"u{i}", "kind": "info", "when": "1d ago"}
                                         for i in range(MAX_UPDATES_PER_CYCLE)])]}
        merge_feed_rows(ds, {"x-2026": [{"text": "new", "kind": "date", "when": "today",
                                         "published_at": "2026-09-04"}]})
        self.assertEqual(len(ds["cycles"][0]["updates"]), MAX_UPDATES_PER_CYCLE)
        self.assertEqual(ds["cycles"][0]["updates"][0]["text"], "new")


class ChangelogTests(unittest.TestCase):
    def test_bounded_newest_first(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "changelog.json"
            for i in range(5):
                append_changelog(p, {"run_at": f"2026-09-0{i + 1}", "changes": []}, max_entries=3)
            data = load_changelog(p)
            self.assertEqual([e["run_at"] for e in data["entries"]],
                             ["2026-09-05", "2026-09-04", "2026-09-03"])
            self.assertEqual(data["updated_at"], "2026-09-05")


class StateTests(unittest.TestCase):
    def test_failure_streaks_and_change_detection(self):
        st = empty_state()
        ok = {"a": {"url": "https://a.gov.in", "ok": True, "hash": "h1"}}
        self.assertEqual(record_sources(st, ok, "t1"), [])
        self.assertEqual(record_sources(st, {"a": {"url": "https://a.gov.in", "ok": True, "hash": "h2"}}, "t2"), ["a"])
        for i in range(3):
            record_sources(st, {"a": {"url": "https://a.gov.in", "ok": False}}, f"f{i}")
        self.assertEqual(st["sources"]["a"]["failures"], 3)
        self.assertEqual(st["sources"]["a"]["hash"], "h2")          # last-good hash kept
        self.assertEqual(st["sources"]["a"]["last_ok"], "t2")
        self.assertEqual(alerting_sources(st)[0]["cycle"], "a")
        record_sources(st, ok, "t3")
        self.assertEqual(st["sources"]["a"]["failures"], 0)
        self.assertEqual(alerting_sources(st), [])

    def test_run_history_bounded_and_roundtrip(self):
        st = empty_state()
        for i in range(MAX_RUNS + 5):
            record_run(st, {"run_at": f"r{i}", "changes": 1 if i == 3 else 0})
        self.assertEqual(len(st["runs"]), MAX_RUNS)
        self.assertEqual(st["runs"][0]["run_at"], f"r{MAX_RUNS + 4}")
        self.assertEqual(st["last_change_at"], "r3")
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "s.json"
            save_state(p, st)
            self.assertEqual(load_state(p)["last_change_at"], "r3")
        self.assertEqual(load_state(Path("/nonexistent/x.json"))["runs"], [])


class MergeDatesTests(unittest.TestCase):
    def test_case_insensitive_label_keeps_curated_text(self):
        merged = _merge_dates(
            [{"label": "Last Date to Apply", "date": "2026-08-19", "is_deadline": True}],
            [{"label": "Last date to apply", "date": "2026-08-25", "is_deadline": True}])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["label"], "Last Date to Apply")
        self.assertEqual(merged[0]["date"], "2026-08-25")


class PageRelevanceTests(unittest.TestCase):
    """A conducting body's home page is shared by all its exams: facts on it
    may only be applied to the exam the page actually names."""

    BODY = {"slug": "ssc", "short": "SSC", "name": "Staff Selection Commission"}

    def test_keywords_exclude_body_and_generic_words(self):
        self.assertEqual(exam_keywords({"exam": "SSC CGL", "title": "SSC CGL 2026", "body": "ssc"}, self.BODY),
                         {"cgl"})
        self.assertEqual(exam_keywords({"exam": "RBI Grade B", "title": "RBI Grade B Officer 2026", "body": "rbi"},
                                       {"short": "RBI", "name": "Reserve Bank of India"}), {"grade b"})

    def test_page_mentions_whole_words_only(self):
        self.assertTrue(page_mentions("<p>SSC CGL 2026 notice</p>", {"cgl"}))
        self.assertFalse(page_mentions("<p>SSC CHSL 2026 notice</p>", {"cgl"}))
        self.assertFalse(page_mentions("<p>Import/export portal</p>", {"po"}))
        self.assertTrue(page_mentions("<p>IBPS PO 2026</p>", {"po"}))

    def test_focus_text_keeps_only_windows_around_mentions(self):
        far = "<p>Specialist Officers: last date to apply 30/09/2026.</p>" + "<p>filler text</p>" * 80
        html = (far + "<h2>Probationary Officers (PO)</h2><p>Last date to apply 25/09/2026.</p>"
                + "<p>filler text</p>" * 80 + far)
        focused = focus_text(html, {"po"}, window=120)
        self.assertIn("25/09/2026", focused)
        self.assertNotIn("30/09/2026", focused)
        self.assertEqual(focus_text("<p>a b</p>", set()), "a b")

    def test_reconcile_takes_dates_only_near_the_exam_mention(self):
        filler = "<p>filler</p>" * 200
        page = ("<p>Specialist Cadre Officers: Last date to apply 30/09/2026</p>" + filler
                + "<h2>SBI PO 2026</h2><p>Last date to apply 25/09/2026</p>")
        cycles = {"sbi-po-2026": _cycle(id="sbi-po-2026", body="sbi", exam="SBI PO", title="SBI PO 2026",
                                        links=[{"kind": "Website", "url": "https://sbi.co.in", "label": "w"}])}
        log, report = [], {}
        reconcile_live(cycles, {"sbi": {"slug": "sbi", "short": "SBI", "name": "State Bank of India"}}, log,
                       scraper=FakeScraper({"https://sbi.co.in": page}), report=report)
        got = {d["label"].lower(): d["date"] for d in cycles["sbi-po-2026"]["dates"]}
        self.assertEqual(got["last date to apply"], "2026-09-25")

    def test_reconcile_applies_only_to_the_named_exam(self):
        page = ("<p>SSC CGL 2026: Total Vacancies: 12,256 posts. Last date to apply 25/08/2026.</p>"
                "<p>Admit cards released for CGL Tier-1.</p>")
        cycles = {
            "ssc-cgl-2026": _cycle(id="ssc-cgl-2026", exam="SSC CGL", title="SSC CGL 2026"),
            "ssc-chsl-2026": _cycle(id="ssc-chsl-2026", exam="SSC CHSL", title="SSC CHSL 2026", vacancy=3712),
        }
        log, report = [], {}
        reconcile_live(cycles, {"ssc": self.BODY}, log,
                       scraper=FakeScraper({"https://ssc.gov.in": page}), report=report)
        self.assertEqual(cycles["ssc-cgl-2026"]["vacancy"], 12256)
        self.assertEqual(cycles["ssc-chsl-2026"]["vacancy"], 3712)          # untouched
        self.assertEqual(cycles["ssc-chsl-2026"]["updates"], [])             # no misattributed release
        self.assertTrue(any(u["kind"] == "admit" for u in cycles["ssc-cgl-2026"]["updates"]))
        self.assertTrue(report["ssc-chsl-2026"]["ok"])                       # reachable ...
        self.assertFalse(report["ssc-chsl-2026"]["relevant"])                # ... but not about CHSL
        self.assertIn("last_checked", cycles["ssc-chsl-2026"])


# --------------------------------------------------------------------------- #
# End-to-end: check / apply / status against a temporary repo layout
# --------------------------------------------------------------------------- #
class FakeScraper:
    """Serves canned HTML per URL; raises for URLs not in `pages`."""

    def __init__(self, pages: dict[str, str]):
        self.pages = pages
        self.calls: list[str] = []

    def fetch(self, url: str) -> FetchResult:
        self.calls.append(url)
        if url not in self.pages:
            raise ConnectionError(f"down: {url}")
        html = self.pages[url]
        return FetchResult(url=url, html=html, status=200, content_hash=content_hash(html))


SSC_PAGE = ("<html><body><h1>CGL 2026</h1><p>Total Vacancies: 12,256 posts.</p>"
            "<p>Last date to apply 25/08/2026</p></body></html>")


class UpdateToolTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / "data").mkdir()
        (self.tmp / "web" / "data").mkdir(parents=True)
        shutil.copy(REPO / "data" / "exams.json", self.tmp / "data" / "exams.json")
        shutil.copy(REPO / "data" / "exams.json", self.tmp / "web" / "data" / "exams.json")
        self.paths = upd.Paths(self.tmp)
        self._env = {k: os.environ.pop(k, None) for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY")}

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
        for k, v in self._env.items():
            if v is not None:
                os.environ[k] = v

    def _read(self, p):
        return json.loads(p.read_text(encoding="utf-8"))

    def test_check_writes_nothing(self):
        before = self.paths.dataset.read_bytes()
        r = upd.run_update("check", live=False, root=self.tmp)
        self.assertEqual(r["mode"], "check")
        self.assertFalse(r["wrote"])
        self.assertEqual(self.paths.dataset.read_bytes(), before)
        self.assertFalse(self.paths.state.exists())
        self.assertFalse(self.paths.changelog.exists())
        self.assertIn("ExamPath data update", upd.report_markdown(r))

    def test_apply_live_records_changes_state_and_changelog(self):
        scraper = FakeScraper({"https://ssc.gov.in": SSC_PAGE})
        r = upd.run_update("apply", live=True, root=self.tmp, scraper=scraper,
                           today=date(2026, 9, 4), publish=False)
        self.assertIsNone(r["refused"])
        self.assertTrue(r["wrote"])
        self.assertGreater(r["material"], 0)
        # dataset + web copy updated with the official value
        ds = self._read(self.paths.dataset)
        ssc = next(c for c in ds["cycles"] if c["id"] == "ssc-cgl-2026")
        self.assertEqual(ssc["vacancy"], 12256)
        self.assertIn("last_checked", ssc)
        self.assertEqual(self._read(self.paths.web_dataset), ds)
        # a feed row with a machine-readable date was written for the vacancy change
        row = next(u for u in ssc["updates"] if u.get("published_at"))
        self.assertEqual(row["published_at"], "2026-09-04")
        # changelog + state persisted
        log = load_changelog(self.paths.changelog)
        self.assertEqual(len(log["entries"]), 1)
        self.assertTrue(any(c["field"] == "vacancy" for c in log["entries"][0]["changes"]))
        st = load_state(self.paths.state)
        self.assertEqual(st["last_run"]["wrote"], True)
        self.assertTrue(st["sources"]["ssc-cgl-2026"]["ok"])
        # every other cycle's source was "down" -> recorded as a failure, curated kept
        self.assertFalse(st["sources"]["upsc-cse-2026"]["ok"])
        self.assertEqual(st["sources"]["upsc-cse-2026"]["failures"], 1)

    def test_second_run_is_quiet_and_keeps_last_good_when_source_down(self):
        scraper = FakeScraper({"https://ssc.gov.in": SSC_PAGE})
        upd.run_update("apply", live=True, root=self.tmp, scraper=scraper,
                       today=date(2026, 9, 4), publish=False)
        first = self.paths.dataset.read_text(encoding="utf-8")
        # same day, SSC now unreachable: no flip-flop back to the curated 17,727
        r = upd.run_update("apply", live=True, root=self.tmp, scraper=FakeScraper({}),
                           today=date(2026, 9, 4), publish=False)
        self.assertEqual(r["material"], 0)
        self.assertIn("ssc-cgl-2026", r["carried_forward"])
        self.assertFalse(r["wrote"])
        self.assertEqual(self.paths.dataset.read_text(encoding="utf-8"), first)
        st = load_state(self.paths.state)
        self.assertEqual(st["sources"]["ssc-cgl-2026"]["failures"], 1)
        self.assertEqual(len(st["runs"]), 2)

    def test_release_row_keeps_original_date_across_runs(self):
        page = "<p>SSC CGL: Admit cards released for Tier-1. Download hall ticket now.</p>"
        scraper = FakeScraper({"https://ssc.gov.in": page})
        upd.run_update("apply", live=True, root=self.tmp, scraper=scraper,
                       today=date(2026, 9, 1), publish=False, force=True)
        ssc = next(c for c in self._read(self.paths.dataset)["cycles"] if c["id"] == "ssc-cgl-2026")
        row = next(u for u in ssc["updates"] if u["text"].startswith("Admit card released"))
        first_date = row["published_at"]
        # the pipeline stamps "today" again; carry-forward must keep the earlier date
        ssc["updates"][ssc["updates"].index(row)]["published_at"] = "2026-08-20"
        ds = self._read(self.paths.dataset)
        for c in ds["cycles"]:
            if c["id"] == "ssc-cgl-2026":
                c["updates"] = ssc["updates"]
        self.paths.dataset.write_text(json.dumps(ds), encoding="utf-8")
        upd.run_update("apply", live=True, root=self.tmp, scraper=scraper,
                       today=date(2026, 9, 5), publish=False, force=True)
        ssc2 = next(c for c in self._read(self.paths.dataset)["cycles"] if c["id"] == "ssc-cgl-2026")
        row2 = next(u for u in ssc2["updates"] if u["text"].startswith("Admit card released"))
        self.assertEqual(row2["published_at"], "2026-08-20")
        self.assertIsNotNone(first_date)

    def test_guard_refuses_large_cycle_drop(self):
        # Pretend the previously published dataset had many more cycles.
        ds = self._read(self.paths.dataset)
        ds["cycles"] = ds["cycles"] + [dict(c, id=f"{c['id']}-copy{i}")
                                       for i in range(3) for c in ds["cycles"]]
        self.paths.dataset.write_text(json.dumps(ds), encoding="utf-8")
        before = self.paths.dataset.read_bytes()
        r = upd.run_update("apply", live=False, root=self.tmp, publish=False)
        self.assertIsNotNone(r["refused"])
        self.assertFalse(r["wrote"])
        self.assertEqual(self.paths.dataset.read_bytes(), before)
        self.assertIn("Refused", upd.report_markdown(r))

    def test_first_apply_without_previous_dataset(self):
        self.paths.dataset.unlink()
        r = upd.run_update("apply", live=False, root=self.tmp, publish=False)
        self.assertTrue(r["wrote"])
        self.assertTrue(self.paths.dataset.exists())
        self.assertEqual(r["change_summary"]["added"], r["published"])

    def test_status_reports_freshness(self):
        now = datetime(2026, 9, 4, 12, 0, tzinfo=timezone.utc)
        s = upd.status(root=self.tmp, max_age_hours=36, now=now)
        self.assertFalse(s["ok"])                       # committed dataset is days old
        self.assertGreater(s["age_hours"], 36)
        upd.run_update("apply", live=False, root=self.tmp, publish=False, force=True)
        gen = self._read(self.paths.dataset)["generated_at"]
        fresh_now = datetime.fromisoformat(gen).replace(tzinfo=timezone.utc) + timedelta(hours=5)
        s = upd.status(root=self.tmp, max_age_hours=36, now=fresh_now)
        self.assertTrue(s["ok"])
        self.assertIsNotNone(s["last_run_at"])
        self.assertIn("OK", upd.status_text(s))

    def test_cli_check_exit_code_and_report(self):
        report = self.tmp / "report.json"
        code = upd.main(["--root", str(self.tmp), "check", "--no-live", "--quiet",
                         "--report", str(report)])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(report.read_text())["mode"], "check")


if __name__ == "__main__":
    unittest.main(verbosity=2)
