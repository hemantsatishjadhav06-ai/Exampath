-- ============================================================================
-- MeraSafar — Supabase / Postgres schema (v1)
-- (A Vayulabs company — brand name and domain are not baked into table
--  names anywhere below, so this schema needs zero changes if the brand
--  ever changes again — only a config value in the frontend would change.)
-- ============================================================================
-- HOW TO USE
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run
--   Safe to re-run (idempotent).
--
-- WHO WRITES WHAT
--   n8n / your automations write using the SERVICE ROLE key (bypasses RLS).
--   The website reads using the PUBLIC (anon) key (read-only, enforced by RLS).
--   The website may also INSERT into page_views using the anon key (for the
--   popularity counter) — nothing else is publicly writable.
--
-- LANGUAGE
--   You feed data in English only. Every table that needs a Hindi version has
--   a matching "_hi" column sitting right next to the English one. Those get
--   filled by an automatic translation step before the row is written (this
--   will be wired up in the code instructions, not something you do by hand).
--   Leaving a _hi column NULL is fine — the site will fall back to English
--   for that field until it's translated.
-- ============================================================================


-- ============================================================================
-- 1. LOOKUPS — states and categories
-- ============================================================================

create table if not exists public.states (
    slug        text primary key,          -- e.g. 'madhya-pradesh'
    name        text not null,              -- 'Madhya Pradesh'
    name_hi     text,
    sort_order  integer default 0           -- lower = shown first (set by popularity later)
);

create table if not exists public.categories (
    slug        text primary key,           -- 'banking' | 'railway' | 'ssc' | 'defense' |
                                             -- 'teaching' | 'state-psc' | 'psu' | 'upsc' ...
    name        text not null,
    name_hi     text,
    icon        text,                       -- an icon identifier the frontend maps to a graphic
    sort_order  integer default 0
);


-- ============================================================================
-- 2. BODIES — conducting bodies (SSC, RRB, IBPS, UPSC, state PSCs...)
-- ============================================================================

create table if not exists public.bodies (
    slug             text primary key,       -- 'ssc', 'rrb', 'mppsc' ...
    name             text not null,           -- 'Staff Selection Commission'
    name_hi          text,
    short_name       text not null,           -- 'SSC'
    level            text not null check (level in ('central','state')),
    state_slug       text references public.states(slug),   -- only set when level = 'state'
    color            text default '#1d4ed8',  -- brand color for badges/icons
    logo_url         text,
    official_url     text,
    description      text,                    -- 2-3 lines shown on the body page
    description_hi   text,

    -- popularity (refreshed periodically — see refresh_popularity() below)
    views_alltime    bigint default 0,
    popularity_rank  integer,

    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists bodies_level_idx on public.bodies(level);
create index if not exists bodies_state_idx on public.bodies(state_slug);
create index if not exists bodies_popularity_idx on public.bodies(popularity_rank);


-- ============================================================================
-- 3. EXAMS — the exam "series" (e.g. SSC CGL), separate from a yearly cycle,
--    because syllabus / pattern / fees / FAQs usually repeat year to year.
-- ============================================================================

create table if not exists public.exams (
    slug                text primary key,      -- 'ssc-cgl'
    body_slug           text references public.bodies(slug) on update cascade,
    category_slug       text references public.categories(slug),
    name                text not null,          -- 'SSC CGL'
    name_hi             text,
    qualification_code  text not null check (qualification_code in ('10th','12th','graduate','pg')),
    description         text,
    description_hi      text,
    official_url        text,

    -- Structured content kept as JSON on purpose — these are naturally nested,
    -- change together, and don't need to be filtered/queried column-by-column.
    -- Keeping them here (instead of 4-5 extra normalised tables) is what keeps
    -- the schema simple, per your "keep it simple" rule.

    syllabus  jsonb not null default '[]',
      -- [{ "subject": "Quantitative Aptitude", "subject_hi": "...",
      --    "topics": ["Algebra","Geometry",...], "topics_hi": ["...","..."] }, ...]

    pattern   jsonb not null default '[]',
      -- [{ "stage_name": "Tier-1", "stage_name_hi": "...",
      --    "duration_minutes": 60, "total_marks": 200,
      --    "negative_marking_note": "0.5 mark deducted per wrong answer",
      --    "sections": [{ "name": "Reasoning", "questions": 25, "marks": 50 }, ...] }, ...]

    fees      jsonb not null default '[]',
      -- [{ "category": "UR", "amount": 100, "notes": "Women exempted" }, ...]

    faqs      jsonb not null default '[]',
      -- [{ "q": "...", "q_hi": "...", "a": "...", "a_hi": "..." }, ...]

    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists exams_body_idx on public.exams(body_slug);
create index if not exists exams_category_idx on public.exams(category_slug);
create index if not exists exams_qual_idx on public.exams(qualification_code);


-- ============================================================================
-- 4. EXAM CYCLES — one row per year's run of an exam (SSC CGL 2026, SSC CGL 2027...)
--    This is the table that changes most often, and the one your automations
--    will update most frequently.
-- ============================================================================

create table if not exists public.exam_cycles (
    id                    text primary key,     -- 'ssc-cgl-2026'
    exam_slug             text references public.exams(slug) on update cascade,
    body_slug             text references public.bodies(slug) on update cascade,  -- denormalised for fast filtering

    title                 text not null,         -- 'SSC CGL 2026'
    title_hi              text,

    status                text not null default 'upcoming' check (status in (
                              'application_open','closing_soon','upcoming',
                              'admit_card','result_awaited','result_out',
                              'completed','exam_scheduled')),

    vacancy               integer default 0,
    vacancy_note          text,

    age_min               integer,
    age_max               integer,
    age_relaxation_note   text,

    summary               text,
    summary_hi            text,
    posts                 text,                  -- comma-separated post names shown on overview
    posts_hi              text,
    schedule_note         text,

    -- These two dates are what the site uses to compute "active" vs "upcoming"
    -- automatically — you never need to set a separate active/upcoming flag.
    application_start     date,
    application_end       date,

    apply_url             text,                  -- shown as the big "Apply now" button

    -- popularity (refreshed periodically)
    views_14d             bigint default 0,
    views_alltime         bigint default 0,
    popularity_rank_14d   integer,

    -- scraper/pipeline bookkeeping
    generated_at          timestamptz,
    last_checked          timestamptz,
    source_hash           text,

    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index if not exists cycles_exam_idx on public.exam_cycles(exam_slug);
create index if not exists cycles_body_idx on public.exam_cycles(body_slug);
create index if not exists cycles_status_idx on public.exam_cycles(status);
create index if not exists cycles_app_end_idx on public.exam_cycles(application_end);
create index if not exists cycles_popularity_idx on public.exam_cycles(popularity_rank_14d);


-- ============================================================================
-- 5. STAGES — the timeline stepper shown on the exam overview tab
-- ============================================================================

create table if not exists public.stages (
    id          bigint generated always as identity primary key,
    cycle_id    text references public.exam_cycles(id) on delete cascade,
    name        text not null,        -- 'Notification', 'Tier-1 Exam', 'Result'...
    name_hi     text,
    date        date,
    done        boolean default false,
    precision   text check (precision in ('day','month','tentative')),
    sort_order  integer default 0
);

create index if not exists stages_cycle_idx on public.stages(cycle_id);


-- ============================================================================
-- 6. KEY DATES — deadlines table shown on the overview tab + site calendar
-- ============================================================================

create table if not exists public.key_dates (
    id           bigint generated always as identity primary key,
    cycle_id     text references public.exam_cycles(id) on delete cascade,
    label        text not null,        -- 'Last Date to Apply'
    label_hi     text,
    date         date not null,
    is_deadline  boolean default false,
    precision    text check (precision in ('day','month','tentative')),
    sort_order   integer default 0
);

create index if not exists key_dates_cycle_idx on public.key_dates(cycle_id);
create index if not exists key_dates_date_idx on public.key_dates(date);


-- ============================================================================
-- 7. VACANCY HISTORY — year-wise seat counts per exam, for trend charts
-- ============================================================================

create table if not exists public.vacancy_history (
    id         bigint generated always as identity primary key,
    exam_slug  text references public.exams(slug) on delete cascade,
    year       integer not null,
    seats      integer not null,
    unique (exam_slug, year)
);


-- ============================================================================
-- 8. CUTOFFS — category-wise cutoff marks per cycle (for the Cutoff tab)
-- ============================================================================

create table if not exists public.cutoffs (
    id          bigint generated always as identity primary key,
    cycle_id    text references public.exam_cycles(id) on delete cascade,
    category    text not null,         -- 'UR','OBC','SC','ST','EWS'...
    phase       text,                  -- 'Tier-1','Tier-2' (optional)
    marks       numeric,
    sort_order  integer default 0
);

create index if not exists cutoffs_cycle_idx on public.cutoffs(cycle_id);


-- ============================================================================
-- 9. CYCLE LINKS — official links (notification PDF, apply, admit card, result...)
-- ============================================================================

create table if not exists public.cycle_links (
    id         bigint generated always as identity primary key,
    cycle_id   text references public.exam_cycles(id) on delete cascade,
    label      text not null,
    label_hi   text,
    url        text not null,
    kind       text not null check (kind in
                 ('notification','apply','admit_card','result','answer_key','website','other')),
    verified   boolean default false
);

create index if not exists cycle_links_cycle_idx on public.cycle_links(cycle_id);


-- ============================================================================
-- 10. UPDATES — the live event feed AND the verification workflow.
--     This is the most important table for your n8n automation to write to.
--
--     THE VERIFICATION LIFECYCLE (per your spec):
--       1. A 3rd-party source (Telegram/website) reports something ->
--          n8n inserts a row here with status = 'unverified'. It shows on the
--          site immediately, with an "Unverified" badge.
--       2. n8n triggers the official-source scraper to check.
--            - If the official source confirms it -> n8n updates status to
--              'auto_verified'. Badge flips to "Verified".
--            - If the official source does NOT confirm it -> row stays
--              'unverified' and n8n sends you a Telegram prompt.
--                - You confirm  -> n8n updates status to 'manual_verified'.
--                - You reject   -> n8n updates status to 'rejected'
--                                   (site query below excludes rejected rows,
--                                   so it disappears from the site).
--       No auto-expiry — a row stays 'unverified' until one of the above happens.
-- ============================================================================

create table if not exists public.updates (
    id            bigint generated always as identity primary key,
    cycle_id      text references public.exam_cycles(id) on delete cascade,

    text          text not null,          -- 'Result declared', 'Last date extended to 19 Aug'
    text_hi       text,

    kind          text not null check (kind in (
                     'notification',     -- general notices -> bucket 1 on homepage
                     'date_change',      -- general notices -> bucket 1
                     'city_intimation',  -- -> bucket 2 (admit card / city info)
                     'admit_card',       -- -> bucket 2
                     'answer_key',       -- -> bucket 3 (answer key / result)
                     'result',           -- -> bucket 3
                     'info')),           -- general notices -> bucket 1

    tab_link      text not null default 'overview' check (tab_link in
                     ('overview','apply','syllabus','pattern','cutoff','admit_card','result')),
                  -- which tab this update should open when clicked

    status        text not null default 'unverified' check (status in
                     ('unverified','auto_verified','manual_verified','rejected')),

    source_type   text check (source_type in ('official','telegram','website')),
    source_ref    text,                   -- URL or a note about where this came from

    published_at  timestamptz default now(),  -- used for "2h ago" style display + sort order
    verified_at   timestamptz,
    created_at    timestamptz not null default now()
);

create index if not exists updates_cycle_idx on public.updates(cycle_id);
create index if not exists updates_status_idx on public.updates(status);
create index if not exists updates_kind_idx on public.updates(kind);
create index if not exists updates_published_idx on public.updates(published_at desc);


-- ============================================================================
-- 11. PAGE VIEWS — raw visit log, feeds the "popular exams" ranking
-- ============================================================================

create table if not exists public.page_views (
    id           bigint generated always as identity primary key,
    entity_type  text not null check (entity_type in ('exam_cycle','body')),
    entity_id    text not null,           -- exam_cycles.id or bodies.slug
    viewed_at    timestamptz not null default now()
);

create index if not exists page_views_entity_idx on public.page_views(entity_type, entity_id);
create index if not exists page_views_time_idx on public.page_views(viewed_at desc);


-- ============================================================================
-- 12. ROW LEVEL SECURITY — public read-only, service-role writes everything.
--     page_views is the one exception: the public key may INSERT (so the
--     live website can log a view) but not read.
-- ============================================================================

alter table public.states           enable row level security;
alter table public.categories       enable row level security;
alter table public.bodies           enable row level security;
alter table public.exams            enable row level security;
alter table public.exam_cycles      enable row level security;
alter table public.stages           enable row level security;
alter table public.key_dates        enable row level security;
alter table public.vacancy_history  enable row level security;
alter table public.cutoffs          enable row level security;
alter table public.cycle_links      enable row level security;
alter table public.updates          enable row level security;
alter table public.page_views       enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['states','categories','bodies','exams','exam_cycles',
                            'stages','key_dates','vacancy_history','cutoffs',
                            'cycle_links','updates']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'public read'
    ) then
      execute format('create policy "public read" on public.%I for select using (true)', t);
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'page_views' and policyname = 'public insert'
  ) then
    create policy "public insert" on public.page_views for insert with check (true);
  end if;
end $$;


-- ============================================================================
-- 13. HELPER VIEW — active vs upcoming, computed automatically from dates
--     (this is exactly the logic behind the Search page's 3 columns and the
--     Body page's Active/Upcoming split — no manual flag needed, ever)
-- ============================================================================

create or replace view public.cycle_application_state as
select
    c.*,
    case
        when c.application_start is not null and c.application_end is not null
             and current_date between c.application_start and c.application_end
            then 'active'
        when c.application_start is not null and current_date < c.application_start
            then 'upcoming'
        else 'other'
    end as application_state
from public.exam_cycles c;


-- ============================================================================
-- 14. VISIBLE UPDATES VIEW — what the website actually queries for the feed
--     (excludes rejected updates automatically)
-- ============================================================================

create or replace view public.visible_updates as
select * from public.updates
where status <> 'rejected'
order by published_at desc;


-- ============================================================================
-- 15. POPULARITY REFRESH — recomputes view counts + ranks.
--     Call this on a schedule (every 1-3 hours) either via:
--       a) Supabase's pg_cron extension (Dashboard -> Database -> Extensions
--          -> enable pg_cron, then: select cron.schedule('refresh-popularity',
--          '0 * * * *', 'select public.refresh_popularity()');)
--       b) or an n8n scheduled workflow that calls this via an RPC request.
-- ============================================================================

create or replace function public.refresh_popularity() returns void as $$
begin
  update public.exam_cycles c set
    views_14d     = coalesce(v.views_14d, 0),
    views_alltime = coalesce(v.views_alltime, 0)
  from (
    select entity_id,
           count(*) filter (where viewed_at > now() - interval '14 days') as views_14d,
           count(*) as views_alltime
    from public.page_views
    where entity_type = 'exam_cycle'
    group by entity_id
  ) v
  where c.id = v.entity_id;

  update public.exam_cycles c set popularity_rank_14d = r.rnk
  from (
    select id, row_number() over (order by views_14d desc) as rnk
    from public.exam_cycles
  ) r
  where c.id = r.id;

  update public.bodies b set views_alltime = coalesce(v.views_alltime, 0)
  from (
    select entity_id, count(*) as views_alltime
    from public.page_views
    where entity_type = 'body'
    group by entity_id
  ) v
  where b.slug = v.entity_id;

  update public.bodies b set popularity_rank = r.rnk
  from (
    select slug, row_number() over (order by views_alltime desc) as rnk
    from public.bodies
  ) r
  where b.slug = r.slug;
end;
$$ language plpgsql security definer;


-- ============================================================================
-- 16b. APP USERS — lightweight accounts, no email required.
--      Sign-up happens with WhatsApp / SMS / Telegram + a one-time code
--      (OTP) instead of a self-chosen password. This is both easier for
--      students (nothing to remember) and safer than storing passwords.
--
--      IMPORTANT: unlike the content tables above, these 4 tables are NOT
--      publicly readable or writable. All access goes through your Next.js
--      backend (using the service-role key) after it verifies who the
--      request is really from. See the RLS section further down.
-- ============================================================================

create table if not exists public.app_users (
    id             uuid primary key default gen_random_uuid(),
    contact_type   text not null check (contact_type in ('whatsapp','sms','telegram')),
    contact_value  text not null,        -- phone number (E.164 format) or telegram chat id
    display_name   text,
    verified       boolean default false,
    created_at     timestamptz not null default now(),
    unique (contact_type, contact_value)
);

-- one-time codes used to verify a sign-up / login attempt
create table if not exists public.otp_codes (
    id             bigint generated always as identity primary key,
    contact_type   text not null check (contact_type in ('whatsapp','sms','telegram')),
    contact_value  text not null,
    code           text not null,
    expires_at     timestamptz not null,
    consumed       boolean default false,
    created_at     timestamptz not null default now()
);
create index if not exists otp_lookup_idx on public.otp_codes(contact_type, contact_value, code);


-- ============================================================================
-- 16c. FOLLOWS — a user following a specific exam cycle for alerts.
--      This *is* the "Follow this exam" button on the exam page — no
--      separate follow concept needed, exactly as you asked.
-- ============================================================================

create table if not exists public.follows (
    id          bigint generated always as identity primary key,
    user_id     uuid references public.app_users(id) on delete cascade,
    cycle_id    text references public.exam_cycles(id) on delete cascade,
    created_at  timestamptz not null default now(),
    unique (user_id, cycle_id)
);
create index if not exists follows_user_idx on public.follows(user_id);
create index if not exists follows_cycle_idx on public.follows(cycle_id);


-- ============================================================================
-- 16d. NOTIFICATION LOG — a record of every alert actually sent, so n8n
--      never sends the same alert twice. n8n reads this table on a
--      schedule to decide who still needs to be messaged.
--
--      Two notification_type values map to your two triggers:
--        'new_update'         -> fires when a followed cycle gets a new row
--                                 in `updates` (result, admit card, date change...)
--        'deadline_reminder'  -> fires once, a few days before
--                                 exam_cycles.application_end, for everyone
--                                 following that cycle who hasn't been
--                                 reminded yet
-- ============================================================================

create table if not exists public.notification_log (
    id                 bigint generated always as identity primary key,
    user_id            uuid references public.app_users(id) on delete cascade,
    cycle_id           text references public.exam_cycles(id) on delete cascade,
    notification_type  text not null check (notification_type in ('new_update','deadline_reminder')),
    update_id          bigint references public.updates(id) on delete set null,
    sent_at            timestamptz not null default now()
);
create index if not exists notif_log_user_idx on public.notification_log(user_id);
create index if not exists notif_log_cycle_idx on public.notification_log(cycle_id);


-- ============================================================================
-- 16e. RLS for the account tables — deliberately locked down.
--      No public policies at all: the anon key can't read or write these
--      four tables. Your Next.js backend uses the service-role key (which
--      bypasses RLS) after verifying the person's session itself. This is
--      the standard, safe pattern for a custom (non-email) login system.
-- ============================================================================

alter table public.app_users        enable row level security;
alter table public.otp_codes        enable row level security;
alter table public.follows          enable row level security;
alter table public.notification_log enable row level security;
-- (no policies created on purpose — see note above)


-- ============================================================================
-- 16. EXAMPLE ROWS — delete these three once you start entering real data.
--     Kept here only so you can confirm everything connects correctly.
-- ============================================================================

insert into public.states (slug, name) values ('madhya-pradesh','Madhya Pradesh')
  on conflict (slug) do nothing;

insert into public.categories (slug, name, icon) values ('ssc','SSC Exams','building')
  on conflict (slug) do nothing;

insert into public.bodies (slug, name, short_name, level, official_url, description)
values ('ssc','Staff Selection Commission','SSC','central','https://ssc.gov.in',
        'Recruits for Group B and C posts across central government ministries and departments.')
  on conflict (slug) do nothing;

insert into public.exams (slug, body_slug, category_slug, name, qualification_code, official_url)
values ('ssc-cgl','ssc','ssc','SSC CGL','graduate','https://ssc.gov.in')
  on conflict (slug) do nothing;

insert into public.exam_cycles (id, exam_slug, body_slug, title, status, vacancy,
                                  age_min, age_max, summary, application_start, application_end, apply_url)
values ('ssc-cgl-2026','ssc-cgl','ssc','SSC CGL 2026','application_open', 17727, 18, 32,
        'Combined Graduate Level — Group B and C posts across central government ministries.',
        '2026-06-28','2026-08-19','https://ssc.gov.in')
  on conflict (id) do nothing;

-- ============================================================================
-- 17. PAPERS — official syllabus documents, answer keys (which contain the
--     actual past question papers) and result notices, year-tagged (2017+).
--     Links point to the conducting body's official site — we never host PDFs.
-- ============================================================================
create table if not exists public.papers (
    id          bigint generated always as identity primary key,
    exam_slug   text references public.exams(slug) on delete set null,
    body_slug   text references public.bodies(slug) on update cascade,
    title       text not null,
    url         text not null,
    year        integer,
    kind        text not null check (kind in ('syllabus','answer_key','result','notice')),
    created_at  timestamptz not null default now()
);
create index if not exists papers_exam_idx on public.papers(exam_slug);
create index if not exists papers_year_idx on public.papers(year);
alter table public.papers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='papers' and policyname='public read') then
    create policy "public read" on public.papers for select using (true);
  end if;
end $$;
