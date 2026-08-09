-- ============================================================================
--  SARKARI-AI  ·  GOVERNMENT EXAM PORTAL  ·  DATABASE SCHEMA (Supabase / Postgres 15+)
-- ============================================================================
--  A production-grade schema for an AI-automated Indian government-exam
--  information portal. Designed around three ideas:
--
--   1. EVERGREEN vs TIME-BOUND. An `exam` (e.g. "SSC CGL") lives forever; each
--      year is an `exam_cycle` (e.g. "SSC CGL 2026") that carries the dates,
--      vacancies, cut-offs and links. Almost every question a user asks
--      ("when does the form close?", "how many seats?") is about a CYCLE.
--
--   2. PIPELINE IS FIRST-CLASS. Raw scrapes, AI extractions, validations,
--      versions and publish events are real tables — so every published fact
--      is traceable back to the page it was scraped from and the model that
--      read it. This is what makes the "> 90% score → publish" gate auditable.
--
--   3. EVERYTHING IS VERSIONED. `content_version` snapshots let us power the
--      "What's changed" feature, diffing, rollback and a full audit trail.
--
--  Convention: snake_case, UUID PKs, timestamptz, `created_at`/`updated_at`
--  on every table (auto-maintained by trigger), soft public/internal split via
--  Row-Level Security. Run top-to-bottom in the Supabase SQL editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_trgm;        -- fuzzy / typo-tolerant search
create extension if not exists unaccent;       -- accent-insensitive search
create extension if not exists btree_gin;      -- composite GIN indexes
-- create extension if not exists vector;      -- (optional) pgvector for semantic search — enable when ready

-- Dedicated schema keeps app tables out of `public` clutter if desired.
-- We use `public` here so Supabase auto-generates the REST/GraphQL API.

-- ---------------------------------------------------------------------------
-- 1. ENUMS  (controlled vocabularies)
-- ---------------------------------------------------------------------------
create type exam_level        as enum ('national','state','ssc','banking','railway','defence','teaching','police','psu','judiciary','other');
create type cycle_status      as enum ('rumoured','announced','notification_out','application_open','application_closed','admit_card','exam_over','result_awaited','result_out','completed','cancelled','postponed');
create type stage_kind        as enum ('notification','application','correction_window','admit_card','prelims','mains','tier1','tier2','tier3','skill_test','physical_test','interview','document_verification','medical','final_result','answer_key','counselling','other');
create type date_status       as enum ('confirmed','tentative','extended','postponed','cancelled');
create type link_kind         as enum ('official_notification','apply_online','admit_card','result','answer_key','syllabus','cutoff','vacancy_pdf','official_website','corrigendum','other');
create type update_kind       as enum ('new_notification','date_change','admit_card','result','answer_key','cutoff','vacancy_change','corrigendum','general');
create type gender_eligibility as enum ('all','male','female','transgender','female_transgender');
create type pipeline_status   as enum ('pending','processing','extracted','validated','needs_review','approved','rejected','published','superseded','failed');
create type source_type       as enum ('official_site','notification_pdf','rss','api','aggregator','social','manual');
create type notify_channel    as enum ('web_push','email','whatsapp','sms','in_app');
create type notify_status     as enum ('queued','sent','delivered','failed','suppressed');

-- ---------------------------------------------------------------------------
-- 2. SHARED HELPERS  (updated_at trigger, slugify)
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Deterministic slug helper (lowercase, hyphenated, ascii). Handy for seeds
-- and as a fallback; the app layer owns canonical slug generation.
create or replace function slugify(txt text) returns text
language sql immutable as $$
  select trim(both '-' from
           regexp_replace(
             regexp_replace(lower(unaccent(coalesce(txt,''))), '[^a-z0-9]+', '-', 'g'),
             '-{2,}', '-', 'g'))
$$;

-- Attach the updated_at trigger to a table by name (called after each table).
create or replace function attach_updated_at(tbl regclass) returns void
language plpgsql as $$
begin
  execute format(
    'create trigger trg_updated_at before update on %s
       for each row execute function set_updated_at()', tbl);
end $$;

-- ============================================================================
--  A. CONTENT DOMAIN  (the public-facing knowledge graph)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 conducting_body — who runs exams (SSC, UPSC, IBPS, RRB, state PSCs…)
-- ---------------------------------------------------------------------------
create table conducting_body (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,                 -- 'ssc', 'upsc', 'ibps', 'rrb', 'mppsc'
  name          text not null,                        -- 'Staff Selection Commission'
  short_name    text,                                 -- 'SSC'
  level         exam_level not null default 'other',
  state_code    text,                                 -- 'MP','UP',… null for national bodies
  official_url  text,
  logo_url      text,
  description   text,
  meta          jsonb not null default '{}',          -- freeform (headquarters, established, etc.)
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
select attach_updated_at('conducting_body');
create index idx_body_level on conducting_body(level) where is_active;
create index idx_body_state on conducting_body(state_code) where state_code is not null;
create index idx_body_name_trgm on conducting_body using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 2.2 exam — the EVERGREEN exam brand ("SSC CGL", "UPSC Civil Services")
-- ---------------------------------------------------------------------------
create table exam (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,            -- 'ssc-cgl', 'upsc-civil-services'
  name               text not null,                   -- 'SSC Combined Graduate Level'
  short_name         text,                            -- 'SSC CGL'
  conducting_body_id uuid not null references conducting_body(id) on delete restrict,
  level              exam_level not null default 'other',
  sector             text,                            -- 'central-govt','banking','railways'
  qualification_tier text,                            -- '10th','12th','graduate','postgraduate'
  overview           text,                            -- evergreen "about this exam"
  tags               text[] not null default '{}',    -- ['graduate','all-india','tier-based']
  search_keywords    text,                            -- extra synonyms for search
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
select attach_updated_at('exam');
create index idx_exam_body on exam(conducting_body_id);
create index idx_exam_level on exam(level) where is_active;
create index idx_exam_tags on exam using gin (tags);
create index idx_exam_name_trgm on exam using gin (name gin_trgm_ops);

-- Exam relationship graph (F-16): "leads to", "similar to", "same syllabus as".
create table exam_relation (
  id           uuid primary key default gen_random_uuid(),
  from_exam_id uuid not null references exam(id) on delete cascade,
  to_exam_id   uuid not null references exam(id) on delete cascade,
  relation     text not null,                         -- 'similar','overlapping_syllabus','feeder','alternative'
  weight       numeric(4,2) not null default 1.0,     -- strength for the graph UI
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (from_exam_id, to_exam_id, relation),
  check (from_exam_id <> to_exam_id)
);
select attach_updated_at('exam_relation');
create index idx_relation_from on exam_relation(from_exam_id);
create index idx_relation_to on exam_relation(to_exam_id);

-- ---------------------------------------------------------------------------
-- 2.3 exam_cycle — the TIME-BOUND instance ("SSC CGL 2026")
--     This is the heart of the portal: dashboards, timelines & feeds hang here.
-- ---------------------------------------------------------------------------
create table exam_cycle (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references exam(id) on delete cascade,
  slug           text not null unique,                -- 'ssc-cgl-2026'
  year           int  not null,
  title          text not null,                       -- 'SSC CGL 2026'
  status         cycle_status not null default 'announced',
  notification_no text,                               -- official notification number
  total_vacancy  int,                                 -- denormalised headline count (detail in `vacancy`)
  short_summary  text,                                -- 1-2 line summary for cards / meta description
  is_featured    boolean not null default false,      -- surface on homepage
  published_at   timestamptz,                         -- when it went live on our site (null = draft)
  meta           jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (exam_id, year)
);
select attach_updated_at('exam_cycle');
create index idx_cycle_exam on exam_cycle(exam_id);
create index idx_cycle_status on exam_cycle(status);
create index idx_cycle_year on exam_cycle(year desc);
create index idx_cycle_featured on exam_cycle(is_featured) where is_featured;
create index idx_cycle_published on exam_cycle(published_at desc) where published_at is not null;

-- ---------------------------------------------------------------------------
-- 2.4 exam_stage — ordered stages of a cycle (drives the TIMELINE component)
-- ---------------------------------------------------------------------------
create table exam_stage (
  id            uuid primary key default gen_random_uuid(),
  cycle_id      uuid not null references exam_cycle(id) on delete cascade,
  kind          stage_kind not null,
  name          text not null,                        -- 'Tier-1 Exam', 'Document Verification'
  sort_order    int not null default 0,               -- timeline ordering
  starts_on     date,
  ends_on       date,                                 -- null for single-day stages
  status        date_status not null default 'tentative',
  location_note text,                                 -- 'Various centres', city, etc.
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
select attach_updated_at('exam_stage');
create index idx_stage_cycle on exam_stage(cycle_id, sort_order);
create index idx_stage_dates on exam_stage(starts_on, ends_on);

-- ---------------------------------------------------------------------------
-- 2.5 key_date — the discrete dates that power "days left" & the calendar (F-8)
--     Kept separate from stages so a single stage can have many dated events
--     (e.g. application: start / end / fee-last-date / correction-window).
-- ---------------------------------------------------------------------------
create table key_date (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references exam_cycle(id) on delete cascade,
  stage_id     uuid references exam_stage(id) on delete set null,
  label        text not null,                         -- 'Application Start','Last Date to Apply','Exam Date'
  event_on     date,                                  -- null = "to be announced"
  event_end_on date,                                  -- for ranges
  status       date_status not null default 'tentative',
  is_deadline  boolean not null default false,        -- true => feeds countdown / deadline calendar
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
select attach_updated_at('key_date');
create index idx_keydate_cycle on key_date(cycle_id);
create index idx_keydate_event on key_date(event_on) where event_on is not null;
create index idx_keydate_deadline on key_date(event_on) where is_deadline;

-- ---------------------------------------------------------------------------
-- 2.6 vacancy — seat counts (headline + breakdown) for "vacancy history" (F-5)
-- ---------------------------------------------------------------------------
create table vacancy (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references exam_cycle(id) on delete cascade,
  post_name    text,                                  -- null => overall
  category     text,                                  -- 'UR','OBC','SC','ST','EWS','PwD','ALL'
  state_code   text,                                  -- for state-wise breakups
  seats        int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
select attach_updated_at('vacancy');
create index idx_vacancy_cycle on vacancy(cycle_id);
create index idx_vacancy_post on vacancy(cycle_id, post_name);

-- ---------------------------------------------------------------------------
-- 2.7 eligibility — structured criteria that power the ELIGIBILITY ENGINE (F-3)
--     Structured columns support fast filtering ("age=21, degree=BA"); the
--     `rules` JSONB captures anything exotic (attempt limits, domicile, etc.).
-- ---------------------------------------------------------------------------
create table eligibility (
  id                 uuid primary key default gen_random_uuid(),
  cycle_id           uuid references exam_cycle(id) on delete cascade,
  exam_id            uuid references exam(id) on delete cascade, -- evergreen fallback
  post_name          text,
  age_min            int,
  age_max            int,
  age_relaxation     jsonb not null default '{}',      -- {"OBC":3,"SC":5,"ST":5,"PwD":10}
  age_as_on          date,                             -- cut-off date for age calc
  min_qualification  text,                             -- 'Bachelor's Degree'
  qualification_codes text[] not null default '{}',    -- ['graduate','any-degree'] for matching
  gender             gender_eligibility not null default 'all',
  nationality        text default 'Indian',
  rules              jsonb not null default '{}',      -- {"attempts":6,"domicile":"MP","physical":{...}}
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (cycle_id is not null or exam_id is not null)
);
select attach_updated_at('eligibility');
create index idx_elig_cycle on eligibility(cycle_id);
create index idx_elig_exam on eligibility(exam_id);
create index idx_elig_age on eligibility(age_min, age_max);
create index idx_elig_qual on eligibility using gin (qualification_codes);

-- ---------------------------------------------------------------------------
-- 2.8 cutoff — historical cut-offs for "cut-off trends" (F-6)
-- ---------------------------------------------------------------------------
create table cutoff (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references exam_cycle(id) on delete cascade,
  stage_id     uuid references exam_stage(id) on delete set null,
  post_name    text,
  category     text,                                  -- 'UR','OBC','SC','ST','EWS'
  marks        numeric(7,2),
  max_marks    numeric(7,2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
select attach_updated_at('cutoff');
create index idx_cutoff_cycle on cutoff(cycle_id);
create index idx_cutoff_trend on cutoff(post_name, category);

-- ---------------------------------------------------------------------------
-- 2.9 official_link — the "Official Sources" block (F-11); trust anchor
-- ---------------------------------------------------------------------------
create table official_link (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid references exam_cycle(id) on delete cascade,
  stage_id    uuid references exam_stage(id) on delete set null,
  kind        link_kind not null,
  label       text not null,
  url         text not null,
  is_official boolean not null default true,
  active_from timestamptz,                             -- e.g. apply link opens
  active_to   timestamptz,                             -- and closes
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
select attach_updated_at('official_link');
create index idx_link_cycle on official_link(cycle_id);
create index idx_link_kind on official_link(kind);

-- ---------------------------------------------------------------------------
-- 2.10 update_feed — "Latest Update" / "What's changed" items (F-12)
--      Every meaningful change spawns a feed row → homepage & dashboards.
-- ---------------------------------------------------------------------------
create table update_feed (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid references exam_cycle(id) on delete cascade,
  exam_id      uuid references exam(id) on delete cascade,
  body_id      uuid references conducting_body(id) on delete cascade,
  kind         update_kind not null default 'general',
  title        text not null,                         -- 'SSC CGL 2026 Last Date Extended to 30 Aug'
  summary      text,
  url_path     text,                                  -- canonical internal link e.g. '/ssc/ssc-cgl-2026'
  importance   int not null default 0,                -- 0..100, ranks the feed
  published_at timestamptz not null default now(),
  meta         jsonb not null default '{}',           -- {"changed":{"last_date":["25 Aug","30 Aug"]}}
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
select attach_updated_at('update_feed');
create index idx_update_published on update_feed(published_at desc);
create index idx_update_cycle on update_feed(cycle_id);
create index idx_update_importance on update_feed(importance desc, published_at desc);

-- ---------------------------------------------------------------------------
-- 2.11 article — long-form content templates for programmatic SEO (SEO System)
--      Syllabus pages, "how to apply", PYQ hubs (F-10), guides.
-- ---------------------------------------------------------------------------
create table article (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  template     text not null default 'guide',         -- 'syllabus','how-to-apply','pyq','guide'
  exam_id      uuid references exam(id) on delete set null,
  cycle_id     uuid references exam_cycle(id) on delete set null,
  body_md      text,                                  -- markdown body
  seo          jsonb not null default '{}',           -- {title, description, canonical, jsonld}
  status       pipeline_status not null default 'pending',
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
select attach_updated_at('article');
create index idx_article_exam on article(exam_id);
create index idx_article_status on article(status);

-- ============================================================================
--  B. DATA PIPELINE DOMAIN  (scrape → extract → validate → version → publish)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 source — a place we scrape (official page, PDF endpoint, RSS, API)
-- ---------------------------------------------------------------------------
create table source (
  id                 uuid primary key default gen_random_uuid(),
  conducting_body_id uuid references conducting_body(id) on delete set null,
  type               source_type not null default 'official_site',
  url                text not null,
  label              text,
  parser_hint        text,                             -- 'ssc_notice_list','generic_pdf'
  crawl_frequency    interval not null default '6 hours',
  is_active          boolean not null default true,
  last_scraped_at    timestamptz,
  last_hash          text,                             -- content hash for change detection
  config             jsonb not null default '{}',      -- selectors, headers, politeness, proxy pool
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
select attach_updated_at('source');
create index idx_source_active on source(is_active, last_scraped_at);
create index idx_source_body on source(conducting_body_id);

-- ---------------------------------------------------------------------------
-- 3.2 scrape_run — one execution of a scraper (kicked off by n8n schedule)
-- ---------------------------------------------------------------------------
create table scrape_run (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references source(id) on delete cascade,
  status       pipeline_status not null default 'pending',
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  http_status  int,
  changed      boolean not null default false,         -- did content hash change vs last_hash?
  error        text,
  stats        jsonb not null default '{}',            -- {docs_found, new, bytes, duration_ms}
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
select attach_updated_at('scrape_run');
create index idx_run_source on scrape_run(source_id, started_at desc);
create index idx_run_status on scrape_run(status);

-- ---------------------------------------------------------------------------
-- 3.3 raw_document — snapshot of scraped content (blob in Storage; meta here)
-- ---------------------------------------------------------------------------
create table raw_document (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references source(id) on delete cascade,
  scrape_run_id uuid references scrape_run(id) on delete set null,
  url          text not null,
  content_hash text not null,                          -- sha256 → dedupe & change detection
  mime_type    text,                                   -- 'text/html','application/pdf'
  storage_path text,                                   -- Supabase Storage key of the raw blob
  fetched_at   timestamptz not null default now(),
  meta         jsonb not null default '{}',            -- {title, http_headers, size}
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (source_id, content_hash)
);
select attach_updated_at('raw_document');
create index idx_raw_source on raw_document(source_id, fetched_at desc);
create index idx_raw_hash on raw_document(content_hash);

-- ---------------------------------------------------------------------------
-- 3.4 extraction — AI reads a raw_document → structured candidate payload
-- ---------------------------------------------------------------------------
create table extraction (
  id             uuid primary key default gen_random_uuid(),
  raw_document_id uuid not null references raw_document(id) on delete cascade,
  model          text not null,                        -- 'claude-…', 'gpt-…'
  prompt_version text,                                 -- track prompt iterations for eval
  target_type    text not null,                        -- 'exam_cycle','key_date','vacancy','eligibility'…
  payload        jsonb not null,                       -- the structured extracted object
  confidence     numeric(5,4),                         -- model self-reported 0..1
  tokens_used    int,
  status         pipeline_status not null default 'extracted',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
select attach_updated_at('extraction');
create index idx_extraction_doc on extraction(raw_document_id);
create index idx_extraction_status on extraction(status);
create index idx_extraction_payload on extraction using gin (payload jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- 3.5 validation — the "> 90% score → publish" GATE (the n8n step 1 & 2)
--     Combines rule checks + AI cross-checks into one score with a breakdown.
-- ---------------------------------------------------------------------------
create table validation (
  id            uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references extraction(id) on delete cascade,
  score         numeric(5,2) not null,                 -- 0..100
  passed        boolean not null default false,        -- score >= threshold AND no hard failures
  threshold     numeric(5,2) not null default 90.0,
  checks        jsonb not null default '[]',           -- [{name, weight, passed, detail}]
  report        text,                                  -- human-readable "verification report"
  reviewed_by   uuid,                                  -- staff user id if human-in-the-loop
  reviewed_at   timestamptz,
  status        pipeline_status not null default 'needs_review',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
select attach_updated_at('validation');
create index idx_validation_extraction on validation(extraction_id);
create index idx_validation_status on validation(status, score desc);

-- ---------------------------------------------------------------------------
-- 3.6 content_version — versioned snapshot of ANY published entity
--     Powers "what's changed", diffing, rollback and audit. `entity_type` +
--     `entity_id` is a polymorphic pointer into the content domain.
-- ---------------------------------------------------------------------------
create table content_version (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null,                         -- 'exam_cycle','key_date',…
  entity_id     uuid not null,
  version_no    int not null,
  snapshot      jsonb not null,                        -- full serialized entity at this version
  diff          jsonb not null default '{}',           -- {field:[old,new]} vs previous version
  source_extraction_id uuid references extraction(id) on delete set null,
  validation_id uuid references validation(id) on delete set null,
  is_current    boolean not null default true,
  created_by    text not null default 'pipeline',      -- 'pipeline' | staff email
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (entity_type, entity_id, version_no)
);
select attach_updated_at('content_version');
create index idx_version_entity on content_version(entity_type, entity_id, version_no desc);
create index idx_version_current on content_version(entity_type, entity_id) where is_current;

-- ---------------------------------------------------------------------------
-- 3.7 publish_event — record of the "feed to page → page updated" step (5)
-- ---------------------------------------------------------------------------
create table publish_event (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null,
  entity_id     uuid not null,
  version_id    uuid references content_version(id) on delete set null,
  action        text not null default 'publish',       -- 'publish','update','unpublish','rollback'
  url_path      text,                                   -- page that was revalidated
  revalidated   boolean not null default false,         -- ISR/CDN purge confirmed
  actor         text not null default 'pipeline',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
select attach_updated_at('publish_event');
create index idx_publish_entity on publish_event(entity_type, entity_id, created_at desc);

-- ============================================================================
--  C. USER DOMAIN  (accounts, personalisation, notifications)
--  Supabase provides auth.users; we mirror a public `profile` (1-1) and hang
--  user-owned data off it. RLS restricts these to their owner.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 4.1 profile — public mirror of auth.users + eligibility profile for matching
-- ---------------------------------------------------------------------------
create table profile (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  -- eligibility profile → powers personalised eligibility & "relevant" notifications
  date_of_birth date,
  category      text,                                  -- 'UR','OBC','SC','ST','EWS'
  gender        gender_eligibility,
  highest_qualification text,
  qualification_codes   text[] not null default '{}',
  home_state    text,
  preferences   jsonb not null default '{}',           -- ui prefs, feed weights
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
select attach_updated_at('profile');

-- Auto-create a profile row when a new auth user signs up.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- 4.2 follow / bookmark — "My Exam", saved exams (F-14/15)
-- ---------------------------------------------------------------------------
create table user_follow (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profile(id) on delete cascade,
  exam_id    uuid references exam(id) on delete cascade,
  cycle_id   uuid references exam_cycle(id) on delete cascade,
  role       text not null default 'interested',        -- 'interested','preparing','applied'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (exam_id is not null or cycle_id is not null),
  unique (user_id, exam_id, cycle_id)
);
select attach_updated_at('user_follow');
create index idx_follow_user on user_follow(user_id);
create index idx_follow_exam on user_follow(exam_id);

-- ---------------------------------------------------------------------------
-- 4.3 subscription — notification topics & channel preferences
-- ---------------------------------------------------------------------------
create table subscription (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profile(id) on delete cascade,
  topic      text not null,                             -- 'exam:ssc-cgl','body:ssc','deadline:*'
  channels   notify_channel[] not null default '{web_push,email}',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic)
);
select attach_updated_at('subscription');
create index idx_sub_user on subscription(user_id);
create index idx_sub_topic on subscription(topic) where is_active;

-- ---------------------------------------------------------------------------
-- 4.4 notification + delivery — generated alerts and per-channel dispatch
-- ---------------------------------------------------------------------------
create table notification (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profile(id) on delete cascade,
  update_id     uuid references update_feed(id) on delete set null,
  title         text not null,
  body          text,
  url_path      text,
  relevance     numeric(5,2) not null default 0,        -- personalised score
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
select attach_updated_at('notification');
create index idx_notif_user on notification(user_id, created_at desc);
create index idx_notif_unread on notification(user_id) where read_at is null;

create table notification_delivery (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notification(id) on delete cascade,
  channel         notify_channel not null,
  status          notify_status not null default 'queued',
  provider_ref    text,                                 -- message id from FCM/email/WhatsApp
  error           text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
select attach_updated_at('notification_delivery');
create index idx_delivery_notif on notification_delivery(notification_id);
create index idx_delivery_status on notification_delivery(status);

-- ---------------------------------------------------------------------------
-- 4.5 push_subscription — Web Push (VAPID) endpoints per device
-- ---------------------------------------------------------------------------
create table push_subscription (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profile(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
select attach_updated_at('push_subscription');

-- ============================================================================
--  D. HELPFUL VIEWS  (read models the API/UI can hit directly)
-- ============================================================================

-- Next upcoming deadline per cycle (feeds "days left" badges & calendar).
create or replace view v_cycle_next_deadline as
select c.id as cycle_id,
       c.slug,
       c.title,
       kd.label,
       kd.event_on,
       (kd.event_on - current_date) as days_left
from exam_cycle c
join lateral (
  select label, event_on
  from key_date k
  where k.cycle_id = c.id and k.is_deadline and k.event_on >= current_date
  order by k.event_on asc
  limit 1
) kd on true
where c.published_at is not null;

-- Active cycles with body + exam denormalised (card/list read model).
create or replace view v_active_cycles as
select c.id, c.slug, c.title, c.year, c.status, c.total_vacancy,
       c.is_featured, c.published_at,
       e.slug as exam_slug, e.short_name as exam_name,
       b.slug as body_slug, b.short_name as body_name, b.level
from exam_cycle c
join exam e on e.id = c.exam_id
join conducting_body b on b.id = e.conducting_body_id
where c.published_at is not null;

-- ============================================================================
--  E. ROW-LEVEL SECURITY
--  Content domain = world-readable when published, writable only by service
--  role (the n8n pipeline / admin). User domain = owner-only.
-- ============================================================================

-- Content: enable RLS, allow anon/auth to SELECT published rows. Writes happen
-- via the service_role key (bypasses RLS) from n8n & server code.
alter table conducting_body enable row level security;
alter table exam            enable row level security;
alter table exam_cycle      enable row level security;
alter table exam_stage      enable row level security;
alter table key_date        enable row level security;
alter table vacancy         enable row level security;
alter table eligibility     enable row level security;
alter table cutoff          enable row level security;
alter table official_link   enable row level security;
alter table update_feed     enable row level security;
alter table article         enable row level security;
alter table exam_relation   enable row level security;

create policy read_bodies on conducting_body for select using (is_active);
create policy read_exams  on exam            for select using (is_active);
create policy read_cycles on exam_cycle      for select using (published_at is not null);
create policy read_stages on exam_stage      for select using (
  exists (select 1 from exam_cycle c where c.id = exam_stage.cycle_id and c.published_at is not null));
create policy read_keydate on key_date       for select using (
  exists (select 1 from exam_cycle c where c.id = key_date.cycle_id and c.published_at is not null));
create policy read_vacancy on vacancy        for select using (true);
create policy read_elig    on eligibility    for select using (true);
create policy read_cutoff  on cutoff         for select using (true);
create policy read_links   on official_link  for select using (true);
create policy read_updates on update_feed    for select using (true);
create policy read_article on article        for select using (status = 'published');
create policy read_relation on exam_relation for select using (true);

-- User domain: strict owner-only.
alter table profile               enable row level security;
alter table user_follow           enable row level security;
alter table subscription          enable row level security;
alter table notification          enable row level security;
alter table notification_delivery enable row level security;
alter table push_subscription     enable row level security;

create policy own_profile on profile for all
  using (auth.uid() = id) with check (auth.uid() = id);
create policy own_follow on user_follow for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_sub on subscription for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_notif on notification for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_delivery on notification_delivery for select
  using (exists (select 1 from notification n where n.id = notification_id and n.user_id = auth.uid()));
create policy own_push on push_subscription for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Pipeline tables (source, scrape_run, raw_document, extraction, validation,
-- content_version, publish_event) intentionally have NO anon policies — they
-- are internal and reached only via the service_role key. Enable RLS so they
-- are locked by default:
alter table source           enable row level security;
alter table scrape_run       enable row level security;
alter table raw_document     enable row level security;
alter table extraction       enable row level security;
alter table validation       enable row level security;
alter table content_version  enable row level security;
alter table publish_event    enable row level security;
-- (no policies = deny all for anon/auth; service_role bypasses RLS)

-- ============================================================================
--  F. SEARCH SUPPORT  (Postgres FTS now; pgvector later)
-- ============================================================================
-- A lightweight materialised search index over the public content. Refresh on
-- publish (or via a cron). Swap/augment with Meilisearch/Typesense at scale.
create materialized view if not exists search_index as
select
  'exam_cycle'::text as kind,
  c.id               as ref_id,
  c.title            as title,
  coalesce(c.short_summary,'') as body,
  '/'||b.slug||'/'||c.slug as url_path,
  setweight(to_tsvector('simple', unaccent(c.title)), 'A') ||
  setweight(to_tsvector('simple', unaccent(coalesce(e.search_keywords,''))), 'B') ||
  setweight(to_tsvector('simple', unaccent(coalesce(c.short_summary,''))), 'C') as tsv
from exam_cycle c
join exam e on e.id = c.exam_id
join conducting_body b on b.id = e.conducting_body_id
where c.published_at is not null;

create index if not exists idx_search_tsv on search_index using gin (tsv);
create index if not exists idx_search_title_trgm on search_index using gin (title gin_trgm_ops);

-- ============================================================================
--  DONE. Next: seed conducting_body + a couple of exams/cycles (see seed.sql),
--  then point n8n's service-role client at these tables.
-- ============================================================================
