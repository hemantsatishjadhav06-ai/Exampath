# ExamPath × Supabase — automated data store + live site

The pipeline scrapes official sources → validates through the >90% gate →
publishes `data/exams.json` → **upserts to Supabase** and appends an immutable
snapshot. A scheduled GitHub Action runs this daily and redeploys the site, so
the data keeps updating itself.

```
 official sources ──scrape──▶ extract ──validate(>90%)──▶ data/exams.json
                                                   │
                                                   ├─▶ Supabase (bodies, cycles, dataset_snapshots)
                                                   └─▶ GitHub Pages (static site, rebuilt each run)
```

Project: `https://nivelgmrbdinroqglalj.supabase.co`

## One-time setup (3 steps)

### 1. Create the schema
Supabase Dashboard → **SQL Editor** → New query → paste
[`db/supabase_schema.sql`](db/supabase_schema.sql) → **Run**.
This creates `bodies`, `cycles`, `dataset_snapshots` with public-read RLS.

(CLI alternative, if you prefer:)
```bash
supabase login
supabase link --project-ref nivelgmrbdinroqglalj
supabase db execute --file db/supabase_schema.sql
```

### 2. Add the service-role key as a GitHub secret
The pipeline needs the **service-role** key to write (the publishable key is
read-only under RLS). Get it from Supabase Dashboard → **Project Settings →
API → `service_role` secret**, then add these repo secrets under
**GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name            | Value                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `SUPABASE_URL`         | `https://nivelgmrbdinroqglalj.supabase.co`                  |
| `SUPABASE_SERVICE_KEY` | your `service_role` secret (**never commit this**)          |
| `SUPABASE_ANON_KEY`    | `sb_publishable_wDkuWCjBBVOpcY6jYkPuLQ_biahD_96` (public)    |

### 3. Enable GitHub Pages
GitHub → **Settings → Pages → Build and deployment → Source → “GitHub Actions”**.
That publishes the site at `https://<owner>.github.io/exampath/`.

## Run it
- **Automatically:** the `Scrape, publish to Supabase & deploy` workflow runs
  daily (cron `30 1 * * *`).
- **On demand:** Actions tab → that workflow → **Run workflow** (toggle *live*).
- **Locally:**
  ```bash
  cd backend && pip install -r requirements.txt
  EXAMPATH_LIVE=1 \
  SUPABASE_URL=https://nivelgmrbdinroqglalj.supabase.co \
  SUPABASE_SERVICE_KEY=<service_role> \
  python -m app.pipeline.run
  ```

## How the website reads Supabase
The build runs `web/scripts/fetch-data.mjs`, which pulls the **latest snapshot**
(`dataset_snapshots`, newest first) into `web/data/exams.json` before exporting.
If Supabase is unset or unreachable it silently falls back to the committed
dataset, so the build never breaks.

## Security notes
- `SUPABASE_ANON_KEY` (`sb_publishable_…`) is designed to be public — it only
  permits the read policies in the schema.
- `SUPABASE_SERVICE_KEY` bypasses RLS — keep it exclusively in GitHub Actions
  secrets / local env. It is never read from committed files.
