-- ExamPath — Supabase / Postgres schema
-- =====================================================================
-- Run this ONCE in your Supabase project:
--   Dashboard -> SQL Editor -> New query -> paste this file -> Run
-- (or: supabase db execute --file db/supabase_schema.sql after `supabase link`)
--
-- It is idempotent: safe to re-run. The scheduled pipeline upserts into
-- these tables via the PostgREST API using the SERVICE-ROLE key (server
-- side, bypasses RLS). The website reads with the public (publishable)
-- key, allowed by the public-read policies below.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Conducting bodies (SSC, UPSC, IBPS, ...)
-- ---------------------------------------------------------------------
create table if not exists public.bodies (
    slug          text primary key,
    name          text not null,
    short         text not null,
    level         text,
    color         text default '#1d4ed8',
    official_url  text,
    updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Exam cycles. Scalar columns are denormalised for cheap querying; the
-- full canonical record (stages, dates, cutoffs, fees, syllabus, ...) is
-- kept verbatim in `data` so the app never loses fidelity.
-- ---------------------------------------------------------------------
create table if not exists public.cycles (
    id                 text primary key,
    body               text references public.bodies(slug) on update cascade,
    exam               text,
    title              text,
    status             text,
    vacancy            integer,
    qualification      text,
    qualification_code text,
    age_min            integer,
    age_max            integer,
    generated_at       date,
    last_checked       timestamptz,       -- when the live scraper last verified it
    source_hash        text,              -- content hash of the official page
    data               jsonb not null,    -- the full cycle object
    updated_at         timestamptz not null default now()
);

create index if not exists cycles_body_idx   on public.cycles (body);
create index if not exists cycles_status_idx on public.cycles (status);

-- ---------------------------------------------------------------------
-- Immutable dataset snapshots — one row per published run. The website's
-- build-time fetch reads the newest snapshot as its single source of
-- truth, so a rebuild always reflects exactly one consistent run.
-- ---------------------------------------------------------------------
create table if not exists public.dataset_snapshots (
    id            bigint generated always as identity primary key,
    generated_at  date,
    source        text default 'exampath-pipeline',
    body_count    integer,
    cycle_count   integer,
    payload       jsonb not null,        -- {generated_at, source, bodies[], cycles[]}
    created_at    timestamptz not null default now()
);

create index if not exists snapshots_created_idx
    on public.dataset_snapshots (created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security: the public/anon key may READ everything and write
-- nothing. The pipeline uses the service-role key, which bypasses RLS.
-- ---------------------------------------------------------------------
alter table public.bodies            enable row level security;
alter table public.cycles            enable row level security;
alter table public.dataset_snapshots enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'bodies'
                     and policyname = 'public read bodies') then
        create policy "public read bodies" on public.bodies
            for select using (true);
    end if;

    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'cycles'
                     and policyname = 'public read cycles') then
        create policy "public read cycles" on public.cycles
            for select using (true);
    end if;

    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'dataset_snapshots'
                     and policyname = 'public read snapshots') then
        create policy "public read snapshots" on public.dataset_snapshots
            for select using (true);
    end if;
end $$;

-- Convenience view: the latest snapshot as a single row.
create or replace view public.latest_snapshot as
    select *
    from public.dataset_snapshots
    order by created_at desc
    limit 1;
