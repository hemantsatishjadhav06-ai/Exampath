---
mode: 'agent'
description: 'Run the ExamPath scraper pipeline in live mode and debug the results against official sources.'
---

Run the full scraper pipeline in live mode and report on data quality:

1. From `backend/`, run `EXAMPATH_LIVE=1 python -m app.pipeline.run`
   (or POST `/pipeline/run` on the deployed API with the
   `x-pipeline-secret` header).
2. From the emitted log, build a table per cycle: official source URL,
   HTTP status, extraction confidence, fields applied
   (vacancy / dates / releases), and the validation-gate score.
3. Flag anything suspicious: confidence ≥ 0.6 that changed a curated value,
   any cycle blocked by the gate, any release signal (result / answer key /
   admit card) newly detected.
4. For flagged cycles, open the official source URL and verify the value by
   hand before proposing a curated-data change. Never edit
   `backend/seed/curated.json` to a value you did not see on the official
   page.
