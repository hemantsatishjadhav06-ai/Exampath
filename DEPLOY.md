# Deploying ExamPath

The website is a **static site** (`web/out/`) produced by a zero-dependency build
(`node web/scripts/export-static.mjs`). That means you can host it anywhere in minutes and
get a public URL. Pick one:

## Option A — Netlify (drag & drop, ~2 min) ⭐ easiest
1. Run `cd web && npm run build` (creates `web/out`).
2. Go to https://app.netlify.com/drop and **drag the `web/out` folder** onto the page.
3. You get a live URL instantly (e.g. `https://your-name.netlify.app`).

To auto-deploy on every push instead: New site → import your GitHub repo → set
**Build command** `cd web && node scripts/export-static.mjs` and **Publish directory** `web/out`.

## Option B — Vercel
Import the repo, then in project settings set **Build Command**
`cd web && node scripts/export-static.mjs`, **Output Directory** `web/out`
(this uses the verified zero-dependency build). Deploy → you get a `*.vercel.app` URL.

## Option C — Cloudflare Pages
Connect the repo → Build command `cd web && node scripts/export-static.mjs`,
Output directory `web/out`.

## Option D — GitHub Pages (automated) 
This repo includes `.github/workflows/deploy-pages.yml`. Push to `main`, then in
**Settings → Pages → Source: GitHub Actions**. It builds and publishes `web/out` for you.

> Note on Pages *project* URLs (`username.github.io/repo`): the site uses root-absolute paths,
> which serve cleanly from a **user/org page** (`username.github.io`) or a **custom domain**.
> For a project subpath, prefer a custom domain, or use Netlify/Vercel/Cloudflare above.

---

## Backend (the pipeline + webhook) — for live data & n8n later
The website is fully functional as a static site from `data/exams.json`. When you want the data
to update automatically:

1. Run the backend somewhere always-on (a small VPS, Railway, Fly.io, or the included Docker):
   ```bash
   docker compose up            # starts the API (:8000) and n8n (:5678)
   ```
2. Point the scraper at real official URLs (`HttpScraper`) and schedule the pipeline.
3. Add **n8n**: create a workflow that POSTs scraped documents to
   `http://api:8000/webhook/n8n` with header `x-webhook-secret: $N8N_WEBHOOK_SECRET`.
4. On publish, re-run `npm run build` and redeploy `web/out` (or wire the Pages/Netlify hook so
   a webhook triggers a rebuild).

## Push this project to GitHub
```bash
./scripts/push-to-github.sh exampath     # uses gh if installed, else prints manual steps
```
