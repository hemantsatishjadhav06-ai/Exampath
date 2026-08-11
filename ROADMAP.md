# ExamPath — Product Roadmap (mass-scale, one-stop govt-exam platform)

This file tracks the full build-out toward a large-scale, commercial-grade
one-stop site. Phases are ordered by impact and dependency. Items marked
**[BLOCKED]** need a credential or a decision from the owner; **[LATER]** are
deliberately deferred.

## ✅ Done (live)
- 10 exams incl. 3 state PSCs (UPPSC/BPSC/RPSC); 8 conducting bodies.
- Tabbed exam dashboard: Overview · Pattern & Syllabus · Cut-offs & Results
  (year-wise, 5 years: vacancies · UR cut-off · result status · official link) ·
  How to Apply (fees, salary, steps, FAQs).
- Category blocks (Central / State), notifications/results/admit-card pages,
  about/faq/contact/disclaimer.
- PWA, SEO (canonical, OG, JSON-LD, sitemap, RSS), CI (test→minify→deploy),
  live on Render (root) + GitHub Pages (mirror), Python auth+AI API on Render.

## Phase 1 — Design system refresh (UI/UX)
Owner disliked the current colour + the floating hero cards.
- New professional, student-first palette (calm, high-contrast, accessible).
- Remove hero "floating cards"; replace with a clear value strip + quick-search.
- Conducting-body **logos/emblems**: use clean monogram badges by default
  (official logos are trademarked — hosting real ones needs permission; we can
  add them later per-body if the owner confirms usage rights).
- Verify at 360/768/1280, light + dark.

## Phase 2 — Data platform on Supabase  **[BLOCKED: SUPABASE_SERVICE_KEY]**
- Schema already exists (`db/supabase_schema.sql`): bodies, cycles, snapshots.
- Extend: `exam_years` (per-year records), `resources` (links to official
  previous-year papers / syllabus PDFs), `users`, `saved_exams`.
- Pipeline writes every run to Supabase (needs the service-role key as a secret).

## Phase 3 — Content scale (toward hundreds of quality pages)
Page-generation engine (no thin/duplicate pages — that hurts SEO):
- Per exam: `/exam/<slug>/` + sub-pages `/syllabus`, `/eligibility`, `/cutoff`,
  `/salary`, `/how-to-apply`, `/previous-papers` (links to official/free
  sources), and `/exam/<slug>/<year>/` year pages.
- Per body, per state, per category, plus guide articles.
- With ~30–40 real exams this reaches **300–500+ genuinely distinct pages**.
- **Previous-year papers:** we link to official/freely-published sources — we do
  **not** scrape or host copyrighted papers. (This is the one item that can't be
  done "store the papers" as written.)

## Phase 4 — AI Q&A via OpenRouter  **[BLOCKED: OPENROUTER_API_KEY]**
- Backend already has `app/llm/openrouter.py` + `/ai/ask`. Set the key as a
  secret on the API service and point the site's "Ask AI" widget at it
  (`window.__AI_API__`) → real LLM answers grounded in the exam dataset.

## Phase 5 — Accounts & user data  (brainstorm below)
- Dedicated storage for login/user data, separate from exam content.
- **Recommended:** Supabase Auth (email/OTP + Google) with row-level security;
  user tables (`profiles`, `saved_exams`, `alerts`) isolated from public data.
- Alternative: keep the current Python auth service, back it with Postgres.

## Phase 6 — [LATER] Messaging automation
- Telegram bot + WhatsApp (Cloud API) deadline/result alerts for followed exams.
- Deferred by owner; design captured here, implement after Phases 1–5.

## Constraints (honest)
- **Past papers:** link to official sources, not host (copyright).
- **Real logos:** trademarked; monogram badges by default.
- **500 pages:** delivered via the generation engine + more real exams, not
  auto-spun thin pages.
- **Credentials needed:** `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_KEY`.
