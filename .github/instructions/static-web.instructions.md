---
applyTo: 'web/**'
description: 'Conventions for the ExamPath zero-dependency static site generator and client script.'
---

# Static web conventions

- `web/scripts/site.mjs` is the single source of page markup; pages are
  plain template-literal HTML rendered from `data/exams.json`. No framework,
  no build tooling, no npm dependencies.
- Every internal `href`/`src` must go through the BASE-aware helpers so the
  site works both at the domain root (Render) and under `/Exampath/`
  (GitHub Pages). Never hardcode absolute paths.
- Every page needs: canonical URL, title + meta description, Open Graph
  tags, and JSON-LD where a schema.org type fits. New page types must be
  added to the sitemap and (when newsworthy) the RSS feed.
- Keep pages fast: inline critical CSS, no external fonts or scripts,
  images as inline SVG monograms (`emblem()`), minify with `MINIFY=1`.
- Client behaviour lives in `web/public/client.js` (vanilla JS, progressive
  enhancement — every feature must degrade to working HTML links).
- Official links open the government site directly; never proxy or re-host
  official PDFs.
- Verify with `node web/scripts/export-static.mjs` (add `BASE_PATH=/Exampath`
  for the Pages variant) before committing.
