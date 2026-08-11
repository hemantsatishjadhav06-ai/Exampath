# ExamPath data verification standard

ExamPath is an information product for high-stakes exam deadlines. The rule is simple:

> **Never turn a plausible value into a verified fact.**

## Source priority

1. The conducting body's current official examination notice / notification PDF.
2. Official corrigendum, reopening notice, extension notice or revised notice.
3. Official vacancy notice / final vacancy document.
4. Official examination calendar for tentative month windows.
5. Official result, admit-card or answer-key page.
6. Never use a coaching site, aggregator or search snippet as the primary source for a factual claim when the official source exists.

## Exact fact checklist

For every exam cycle, check these fields independently:

- Exam name and year
- Conducting body
- Notification publication date
- Application start date
- Original closing date
- Any reopened / extended application window
- Fee payment deadline
- Correction window
- Exact exam date, only when officially published
- Tentative exam month/range, when only a calendar window is available
- Vacancy count and whether it is tentative or final
- Post names
- Qualification
- Age limits by post where applicable
- Age cut-off date
- Category age relaxations
- Nationality / citizenship rules
- Application fee and exemptions
- Selection stages
- Exam pattern
- Negative marking
- Syllabus
- Official application URL
- Official notification URL
- Result / admit-card / answer-key URLs when published
- Source publication date
- Last verification timestamp

## Example: SSC CGL 2026

The repository previously contained dates and vacancy values that conflicted with the official SSC notice. The verified override now uses the official SSC notice and reopening notice.

Official notice:
`https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf`

The notice states:

- Applications: 21 May 2026 to 22 June 2026
- Original application closing time: 22 June 2026, 23:00 hours
- Fee payment: 23 June 2026, 23:00 hours
- Correction window: 29 June to 1 July 2026, 23:00 hours
- Tier-I: August–September 2026 (tentative)
- Tier-II: December 2026 (tentative)
- Approx. 12,256 tentative vacancies
- Age limits vary by post: 18–27, 20–30, 18–30 or 18–32 years

SSC subsequently published a reopening notice:
`https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/CGLE_Reopen_23062026.pdf`

That notice reopened applications for 23–25 June 2026 and moved fee payment to 26 June 2026 and correction to 1–3 July 2026.

### Important implementation rule

Do **not** invent an exact Tier-I date such as `22 September 2026` when the official notice only says `August–September 2026`.

The data model therefore supports `precision: "tentative"` and allows a stage to have no exact day.

## Verification UI

Every exam should visibly communicate one of:

- **Official-source verified** — important claims have an identified official source and review date.
- **Partially source-verified** — some claims are sourced but gaps remain.
- **Source verification required** — the record is not safe to present as authoritative.

Never display `100% official-source verified` globally unless the pipeline can prove field-level provenance for every published factual field.

## Data QA commands

From `web/`:

```bash
npm run validate:data
npm run validate:data:strict
```

The normal audit reports warnings. Strict mode fails on structural provenance errors and should be enabled in CI once the complete dataset has source evidence.
