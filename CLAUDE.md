# MeraSafar — agent guide (merasafar branch)

Read `.github/copilot-instructions.md` for the app map and rules (no mock
data, queries via `lib/queries.ts`, both locales always, mode-toggle CSS
variables, secrets only in env vars).

## Installed skills (`.claude/skills/`)

- **ui-ux-pro-max** — use for ANY visual/interaction change. The app
  follows its "Accessible & Ethical" profile: contrast ≥ 4.5:1, visible
  focus rings, 44px touch targets, reduced-motion support — do not regress
  these in either MeraSafar or Sarkari mode.
- **superpowers process skills** — `test-driven-development`,
  `systematic-debugging`, `verification-before-completion` (build and show
  output before claiming success), `writing-plans`/`executing-plans`,
  and the code-review pair around PRs.

## Quick commands

- Build: `DATA_MODE=seed npx next build`
- Local run: `DATA_MODE=seed npx next start`
