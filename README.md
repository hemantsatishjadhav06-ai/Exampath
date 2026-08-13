# MeraSafar — a Vayulabs company

Bilingual (EN/HI), SEO-first Indian government-exam portal. Next.js 14 App Router +
Supabase + Vercel on-demand ISR. Built from `BRIEF.md`; database schema in `db/schema.sql`.

## Setup
1. `npm install`
2. Run `db/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` → `.env.local` and fill the values.
4. `npm run dev`

## Deploy (Vercel — required for on-demand ISR)
1. Import this repo in Vercel, set the env vars from `.env.example`.
2. In Supabase → Database → Webhooks: POST INSERT/UPDATE on `exam_cycles, updates,
   key_dates, stages, cutoffs, cycle_links, bodies, exams` to
   `https://<domain>/api/revalidate` with header `x-revalidate-secret: $REVALIDATE_SECRET`.
3. Enable pg_cron and schedule `select public.refresh_popularity();` hourly.

Brand/domain/email live ONLY in `lib/site-config.ts`.
