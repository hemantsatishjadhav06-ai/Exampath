# MeraSafar — Build Instructions for Claude Code

A Vayulabs company. Government exam information platform for India — competitor to
sarkariresult.com, built to be faster, cleaner, bilingual, and SEO-first.

This document is the complete spec. Build the project fresh (do not reuse code from
any prior repo) — this doc is self-contained. Use the accompanying
`merasafar_supabase_schema.sql` as the single source of truth for the database; do not
invent additional tables without checking against it first.

---

## 1. Tech stack

- **Framework**: Next.js 14, App Router, TypeScript, Tailwind CSS
- **Database**: Supabase (Postgres). Schema already defined — see the `.sql` file.
- **Hosting**: Vercel (required — the freshness strategy below depends on Vercel's
  on-demand ISR; static export or GitHub Pages will NOT work for this project)
- **No mock data anywhere.** Every page reads from Supabase. If a table is empty,
  render an empty state — never hardcode placeholder exam data.

---

## 2. Config, not hardcoding

Brand name, domain, and contact email are **not final** and will change. Put them in
one place only:

```
/lib/site-config.ts

export const siteConfig = {
  name: "MeraSafar",
  parentCompany: "Vayulabs",
  domain: "merasafar.in",          // placeholder — update when finalized
  supportEmail: "contact@merasafar.in", // placeholder
  defaultLocale: "en",
  locales: ["en", "hi"],
};
```

Every page/component that shows the brand name, domain, or email must import from
here — never write the string literally elsewhere. This is a hard rule.

---

## 3. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # public, RLS-restricted — used in browser + most server code
SUPABASE_SERVICE_ROLE_KEY=           # secret, server-only — used ONLY in API routes that need
                                      # to write to app_users / otp_codes / follows / notification_log
REVALIDATE_SECRET=                   # random string — protects the on-demand revalidation endpoint
WHATSAPP_API_KEY=                    # for OTP delivery — provider TBD by Abhi
TELEGRAM_BOT_TOKEN=                  # for OTP delivery via Telegram
SMS_API_KEY=                         # for OTP delivery via SMS fallback
```

Two Supabase clients:
- `lib/supabase/client.ts` — anon key, used for public reads and the page-view insert.
- `lib/supabase/admin.ts` — service-role key, used **only** inside `/app/api/*` routes
  that touch the account tables. Never import this client in any component that runs
  in the browser.

---

## 4. Freshness strategy: ISR + on-demand revalidation (this is the core architecture decision — implement exactly as described)

Every exam/body/category page is statically generated and cached (fast, SEO-friendly).
Freshness comes from **webhook-triggered revalidation**, not polling and not full
rebuilds.

1. In Supabase, set up a **Database Webhook** (Dashboard → Database → Webhooks) on
   `INSERT`/`UPDATE` for `exam_cycles`, `updates`, `key_dates`, `stages`, `cutoffs`,
   `cycle_links`, `bodies`, `exams`. Each webhook POSTs to:
   `https://<domain>/api/revalidate`
2. Build `/app/api/revalidate/route.ts`:
   - Verify a shared secret (`REVALIDATE_SECRET`) sent as a header from the Supabase
     webhook config, reject if missing/wrong.
   - Read the changed row's table + relevant slug/id from the webhook payload.
   - Call `revalidatePath()` for every route that row affects. Example: an `updates`
     row changing means revalidate `/exam/[slug]` (overview tab) AND whichever
     specific tab `tab_link` points to, in both `/en/` and `/hi/` (if using a locale
     prefix structure — see section 6).
3. Result: a change in Supabase reaches the live site in a few seconds, without
   rebuilding the whole site and without client-side polling.

Do NOT use `revalidate: N` time-based ISR as the primary mechanism — use it only as a
safety-net fallback (e.g. `revalidate: 3600` on top of on-demand, in case a webhook
is ever missed).

---

## 5. Route structure

```
/app
  /[locale]                       -> "en" | "hi", en has no visible prefix in the URL
    /page.tsx                     -> Home
    /search/page.tsx              -> Search / Eligibility Finder
    /calendar/page.tsx            -> Site-wide calendar (month strip + list)
    /bodies/page.tsx               -> All bodies directory (with active/upcoming counts)
    /body/[bodySlug]/page.tsx      -> Single body page
    /exam/[cycleId]/page.tsx       -> Overview tab
    /exam/[cycleId]/apply/page.tsx
    /exam/[cycleId]/syllabus/page.tsx
    /exam/[cycleId]/exam-pattern/page.tsx
    /exam/[cycleId]/cutoff/page.tsx
    /exam/[cycleId]/admit-card/page.tsx   -> also carries city-intimation content
    /exam/[cycleId]/result/page.tsx       -> also carries answer-key content
    /category/qualification/[q]/page.tsx  -> 10th | 12th | graduate | pg
    /category/type/[cat]/page.tsx         -> banking | railway | ssc | defense | teaching | state-psc | psu | upsc
    /category/state/[stateSlug]/page.tsx
    /about/page.tsx
    /contact/page.tsx
    /privacy-policy/page.tsx
    /disclaimer/page.tsx
    /terms/page.tsx
  /api
    /revalidate/route.ts           -> webhook receiver (section 4)
    /auth/send-otp/route.ts        -> account system (section 9)
    /auth/verify-otp/route.ts
    /follow/route.ts                -> follow/unfollow a cycle (requires session)
    /track-view/route.ts            -> page-view logging (section 8) — OR do this
                                        client-side directly with the anon key; either
                                        is fine, pick one and be consistent
  /sitemap.ts                      -> sitemap INDEX (splits into sub-sitemaps —
                                        section 11)
  /robots.ts
```

The English site has no `/en/` prefix in the visible URL (`merasafar.in/exam/...`);
Hindi uses `/hi/exam/...`. Implement via `middleware.ts` locale detection +
`generateStaticParams` per locale — do not literally nest routes under a visible
`/en/` folder segment in the URL.

Every page must emit `<link rel="alternate" hreflang="...">` pointing to its
counterpart in the other language, plus `hreflang="x-default"` pointing to the
English version.

---

## 6. Bilingual content: how Hindi text gets populated

Abhi enters data in English only. Do not build a UI for manual Hindi entry.

Implement a **Supabase Edge Function** (`translate-on-write`) triggered by a database
webhook on `INSERT`/`UPDATE` of any row with a `_hi` column that is currently `NULL`
(check `exams`, `exam_cycles`, `bodies`, `categories`, `states`, `stages`,
`key_dates`, `cycle_links`, `updates`). The function:

1. Reads the English field(s) that changed.
2. Calls a translation API (start with a simple option — Google Cloud Translation
   API or similar; abstract this behind a single function so the provider can be
   swapped later without touching call sites).
3. Writes the result back into the matching `_hi` column.
4. For the JSON fields on `exams` (`syllabus`, `pattern`, `fees`, `faqs`), translate
   each nested string value that has a `_hi` sibling key inside the JSON.

The frontend logic: if a `_hi` field is `NULL` when rendering the Hindi route, fall
back to the English value rather than showing blank text. Never block a page from
rendering because translation hasn't completed yet.

---

## 7. Component list (build these once, reuse everywhere — do not duplicate per page)

- `Header` — logo, language switcher (links to the `hreflang` counterpart of the
  current page, not just the homepage)
- `AboutBlurbShort` / `AboutBlurbLong` — used on Home (short at top, long near
  footer) and reusable in About page
- `SearchFilterForm` — qualification / age / conducted-by / category, all optional,
  submits to `/search` with query params; reused on `/search`, homepage, and (scoped
  to one body) on body pages
- `UpdatesFeed3Column` — bucket updates by `kind` into Notices / Admit-Card-City-Info
  / Answer-Key-Result; each item links using `tab_link`; shows the verification
  badge (`unverified` / `auto_verified` / `manual_verified` → display both auto and
  manual verified as "Verified")
- `ExamCard` — body · qualification · age range · status pill · deadline countdown;
  used in search results, homepage feeds, body pages
- `PopularGrid` — reads `popularity_rank_14d` / `popularity_rank` ordered lists
- `BodyIconGrid` — central/state icon grids with a "view all" link
- `ExamTabBar` — overview / apply / syllabus / exam-pattern / cutoff /
  admit-card (labelled "Admit Card / City Info") / result (labelled "Result / Answer
  Key"); each tab is a real link to its own route, styled to look like a tab
- `TimelineStepper` — reads `stages`, done vs pending
- `KeyDatesTable` — reads `key_dates`
- `MonthCalendar` — month-selector strip + list of that month's `key_dates` /
  `updates` (NOT a full date grid — this was explicitly simplified during design)
- `FollowButton` — toggles a row in `follows`; if no session, opens `AuthModal`
  first
- `AuthModal` — contact-method picker (WhatsApp/SMS/Telegram) → OTP entry → on
  success, calls `/api/follow`
- `ExamAlertPopup` — appears on exam pages (not homepage), nudges sign-up, wraps
  `FollowButton`
- `AdSlot` — takes a `slot` id, lazy-loads (see section 12), caps enforced by usage
  discipline (max 3 per page — do not add more call sites than the design specifies)

---

## 8. Popularity tracking

- On every `exam_cycles` and `bodies` page view, insert a row into `page_views`
  (`entity_type`, `entity_id`) using the anon key — RLS allows public insert only,
  per the schema.
- Do this as a fire-and-forget client-side call (don't block rendering on it).
- Schedule `select public.refresh_popularity();` to run hourly. Simplest option:
  enable the `pg_cron` extension in Supabase and schedule it directly in SQL — no
  extra service needed:
  ```sql
  select cron.schedule('refresh-popularity', '0 * * * *',
                        'select public.refresh_popularity()');
  ```
  (Alternative: an n8n scheduled workflow calling the function via Supabase's RPC
  endpoint — use this only if pg_cron isn't available on Abhi's Supabase plan.)

---

## 9. Account & notification system

No email, no self-chosen passwords — WhatsApp/SMS/Telegram + OTP.

1. `/api/auth/send-otp` (POST: `contact_type`, `contact_value`) — generates a 6-digit
   code, stores it in `otp_codes` with a short expiry (5 min), and sends it via the
   matching provider (WhatsApp Business API / Telegram Bot API / SMS gateway —
   integrate whichever Abhi has access to; abstract behind a `sendOtp()` function).
2. `/api/auth/verify-otp` (POST: `contact_type`, `contact_value`, `code`) — checks
   `otp_codes`, marks it consumed, upserts a row in `app_users`, and issues a signed
   session token (JWT, e.g. via `jose`) in an **httpOnly, secure cookie**. This
   cookie is the session — there is no Supabase Auth user involved, this is a fully
   custom flow, which is why RLS on these 4 tables denies all public access (section
   16e of the SQL file) and every write goes through these API routes using the
   service-role key server-side.
3. `/api/follow` (POST: `cycle_id`) — reads the session cookie, verifies it, inserts/
   deletes the matching `follows` row using the service-role key.
4. Notification sending is n8n's job, not the website's: a scheduled n8n workflow
   queries `follows` joined against `updates` (for new-update alerts) and against
   `exam_cycles.application_end` (for deadline reminders), skips anything already in
   `notification_log`, sends the message via WhatsApp/Telegram/SMS, and inserts the
   corresponding `notification_log` row. Abhi will build/adjust this workflow himself
   — the website side only needs to expose clean, queryable tables, which the schema
   already does.

---

## 10. Page-by-page data requirements

Below is the minimum Supabase query per page. Use Server Components and fetch
directly (no client-side loading spinners for primary content).

- **Home**: short about text (static/config) · `SearchFilterForm` (no query, just
  renders) · `updates` joined to `exam_cycles`/`bodies`, last ~10-15 per `kind`
  bucket, `visible_updates` view · top exams from `popularity_rank_14d` (limit
  6-12) · `bodies` ordered by `popularity_rank`, split by `level` (limit ~8 each) +
  "view all" links · long about text (static/config)
- **Search**: parse query params → filter `exam_cycles` joined to `exams`
  (qualification, age range overlap) and `bodies` (conducted-by) → compute
  application_state via the `cycle_application_state` view for the Active/Upcoming
  split → Upcoming column additionally filtered to `application_start` within next
  4-6 months
- **Body page**: `bodies` row by slug · `exam_cycles` for that body split by
  `cycle_application_state` · that body's `key_dates`/`updates` for the month
  calendar · optional scoped filter reuses `SearchFilterForm` with `body_slug`
  pre-set
- **Exam overview**: `exam_cycles` row + joined `exams` (for syllabus/pattern/fees/
  faqs JSON, though those render on their own tabs) · `stages` · `key_dates` ·
  `visible_updates` for this cycle
- **Exam apply**: `exam_cycles.apply_url` + a short generated "how to apply" summary
  (can be a static per-body template combined with the cycle's key dates — do not
  require a new table for this unless Abhi wants per-cycle custom apply text, in
  which case add a `apply_note` column to `exam_cycles` rather than a new table)
- **Exam syllabus / pattern / cutoff**: `exams.syllabus` / `exams.pattern` /
  `cutoffs` for the cycle
- **Exam admit-card / result**: `cycle_links` filtered by `kind`, plus
  `visible_updates` filtered by matching `kind` values
- **Calendar**: month-strip + `key_dates` across all cycles for the selected month
- **Bodies directory**: all `bodies` with counts computed via the
  `cycle_application_state` view grouped by `body_slug`
- **Category pages**: `exams`/`exam_cycles` filtered by `category_slug` /
  `qualification_code` / `bodies.state_slug`

---

## 11. SEO implementation

- `sitemap.ts` returns a sitemap **index** pointing to generated sub-sitemaps
  (exams, bodies, categories, static) — do not put 1000+ URLs in a single sitemap
  file.
- `robots.ts` allows all, references the sitemap index.
- Every page sets `generateMetadata()` with a unique title/description built from
  the actual row data (e.g. "SSC CGL 2026 Syllabus — MeraSafar", not a generic
  template repeated everywhere).
- Structured data: add JSON-LD on exam pages using `schema.org/JobPosting` (or
  `Event` for the exam date itself) populated from `exam_cycles` fields — this is
  what enables rich results in Google.
- `hreflang` pairs on every page (section 5).
- Core Web Vitals: use `next/image` for all images, load AdSense scripts with
  `strategy="lazyOnload"`, avoid layout shift by reserving ad slot dimensions
  up-front.

---

## 12. AdSense placement (max 3 per page, exactly as designed)

- Header banner (below nav)
- One in-content unit (after the intro/first section) on exam and long-content
  pages
- One in-feed native unit inside the homepage updates feed (after ~8 items)

Do not add sidebar or additional in-content units beyond this without a design
decision first — more ad units was explicitly ruled out during design for UX and
Core Web Vitals reasons.

---

## 13. What NOT to do

- No mock/placeholder exam data anywhere, ever — empty states instead.
- No client-side language switching (must be real separate crawlable routes).
- No full-date-grid calendar (month-strip + list only, per design).
- No more than 3 ad units per page.
- No storing OTPs or sessions insecurely (no plaintext codes past their check, no
  non-httpOnly cookies for the session).
- No hardcoded brand name/domain/email outside `site-config.ts`.
- No static export / GitHub Pages hosting — must be Vercel for on-demand ISR to work.

---

## 14. Build order (suggested)

1. Scaffold Next.js project, Tailwind, Supabase clients, `site-config.ts`
2. Run the SQL schema against Supabase, confirm the 5 example rows appear
3. Build shared components (section 7) against the example data
4. Build Home, Exam overview + tabs, Body page, Search — the core loop
5. Wire up `/api/revalidate` + Supabase Database Webhooks, confirm a manual edit in
   Supabase shows up on the live site within seconds
6. Build Calendar, directories, category pages
7. Build About/Contact/Privacy/Disclaimer/Terms
8. Build the account/OTP/follow system + notification-relevant tables (this can come
   after the core site is live — it doesn't block launch)
9. Wire up the translation Edge Function last, once English content is flowing
   correctly
10. SEO pass: sitemap, robots, structured data, hreflang audit
11. AdSense integration
