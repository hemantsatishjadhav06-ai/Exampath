---
mode: 'agent'
description: 'Add a new exam cycle to ExamPath with verified official data.'
---

Add a new exam cycle to the curated dataset:

1. Ask for (or locate) the **official notification URL** on the conducting
   body's government site. Every fact below must come from that page.
2. Add the cycle to `backend/seed/curated.json` following the existing
   shape: id (`body-exam-year`), body, exam, title, status, vacancy,
   qualification + code, age range, dates (with `is_deadline`), links
   (Notification / Apply / Website), and updates.
3. If the conducting body is new, add it to `bodies` with `official_url`
   and any dedicated `notice_urls`.
4. Run `python -m unittest discover -q tests` from `backend/`, then
   `python -m app.pipeline.run` and confirm the new cycle passes the 90%
   validation gate.
5. Rebuild the site (`node web/scripts/export-static.mjs`) and check the
   new exam page renders with correct dates and working official links.
