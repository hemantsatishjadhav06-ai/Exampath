# ExamPath — agent guide

Read `.github/copilot-instructions.md` for the architecture map and the
non-negotiable rules (official sources only, zero-dependency web + backend,
the 90% validation gate, no secrets in the repo).

## Installed skills (`.claude/skills/`)

- **ui-ux-pro-max** — searchable UI/UX design intelligence. Use for ANY
  change that alters how the site looks, feels, moves, or is interacted
  with. Query it (`scripts/search.py`) before choosing styles, colors,
  typography, or interaction patterns. The site follows its "Accessible &
  Ethical" profile: contrast ≥ 4.5:1, visible focus rings, 44px touch
  targets, reduced-motion support — do not regress these.
- **superpowers process skills** (obra/superpowers) — apply to backend and
  frontend work alike: `test-driven-development` and `systematic-debugging`
  for the Python pipeline/API, `verification-before-completion` before any
  claim that something works (run the tests / the build and show output),
  `writing-plans` + `executing-plans` for multi-step work,
  `requesting-code-review` / `receiving-code-review` around PRs.

## Quick commands

- Backend tests: `cd backend && python -m unittest discover -q tests`
- Site build: `node web/scripts/export-static.mjs` (add `BASE_PATH=/Exampath`
  for the GitHub Pages variant; output in `web/out/`)
- Live scrape (guarded): POST `/pipeline/run` with `x-pipeline-secret`
- Auto data update (see `docs/auto-update.md`): from `backend/`,
  `python -m app.pipeline.update check --live` (dry run report),
  `... apply --live` (refresh data + changelog + state), `... status`
  (freshness health). Runs 4×/day via `.github/workflows/scrape-and-publish.yml`.
- Workflow lint: `actionlint .github/workflows/*.yml` before touching CI.
