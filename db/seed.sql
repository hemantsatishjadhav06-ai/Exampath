-- ============================================================================
--  SEED DATA — a realistic slice: SSC → SSC CGL → SSC CGL 2026
--  Safe to run after schema.sql. Idempotent-ish (uses ON CONFLICT on slugs).
-- ============================================================================

-- Conducting body ------------------------------------------------------------
insert into conducting_body (slug, name, short_name, level, official_url, description)
values ('ssc','Staff Selection Commission','SSC','ssc','https://ssc.gov.in',
        'Central body that recruits for Group B & C posts across ministries.')
on conflict (slug) do nothing;

insert into conducting_body (slug, name, short_name, level, official_url)
values ('upsc','Union Public Service Commission','UPSC','national','https://upsc.gov.in'),
       ('ibps','Institute of Banking Personnel Selection','IBPS','banking','https://ibps.in'),
       ('rrb','Railway Recruitment Board','RRB','railway','https://indianrailways.gov.in'),
       ('mppsc','Madhya Pradesh Public Service Commission','MPPSC','state','https://mppsc.mp.gov.in')
on conflict (slug) do nothing;

-- Exam (evergreen) -----------------------------------------------------------
insert into exam (slug, name, short_name, conducting_body_id, level, qualification_tier, overview, tags, search_keywords)
select 'ssc-cgl','SSC Combined Graduate Level','SSC CGL', b.id, 'ssc', 'graduate',
       'National exam for graduate-level Group B & C posts in central government.',
       array['graduate','all-india','tier-based'],
       'ssc cgl combined graduate level assistant inspector income tax'
from conducting_body b where b.slug='ssc'
on conflict (slug) do nothing;

-- Cycle (time-bound) — publish it so RLS/read views see it -------------------
insert into exam_cycle (exam_id, slug, year, title, status, notification_no, total_vacancy, short_summary, is_featured, published_at)
select e.id, 'ssc-cgl-2026', 2026, 'SSC CGL 2026', 'application_open', 'SSC/CGL/2026/01',
       17727, 'SSC CGL 2026 notification out — 17,727 vacancies. Apply before the last date.',
       true, now()
from exam e where e.slug='ssc-cgl'
on conflict (slug) do nothing;

-- Stages (timeline) ----------------------------------------------------------
insert into exam_stage (cycle_id, kind, name, sort_order, starts_on, ends_on, status)
select c.id, k.kind::stage_kind, k.name, k.ord, k.s, k.e, k.st::date_status
from exam_cycle c,
(values
  ('notification','Notification', 1, date '2026-06-24', date '2026-06-24','confirmed'),
  ('application','Online Application', 2, date '2026-06-24', date '2026-07-24','confirmed'),
  ('tier1','Tier-1 Exam', 3, date '2026-09-10', date '2026-09-20','tentative'),
  ('tier2','Tier-2 Exam', 4, date '2026-12-05', date '2026-12-08','tentative'),
  ('document_verification','Document Verification', 5, null, null,'tentative'),
  ('final_result','Final Result', 6, null, null,'tentative')
) as k(kind,name,ord,s,e,st)
where c.slug='ssc-cgl-2026';

-- Key dates (drive "days left") ---------------------------------------------
insert into key_date (cycle_id, label, event_on, status, is_deadline)
select c.id, k.label, k.d, 'confirmed'::date_status, k.dl
from exam_cycle c,
(values
  ('Application Start', date '2026-06-24', false),
  ('Last Date to Apply', current_date + 12, true),   -- 12 days from "now" for the demo
  ('Last Date to Pay Fee', current_date + 13, true),
  ('Tier-1 Exam Date', date '2026-09-10', false)
) as k(label,d,dl)
where c.slug='ssc-cgl-2026';

-- Vacancy breakdown ----------------------------------------------------------
insert into vacancy (cycle_id, post_name, category, seats)
select c.id, v.post, v.cat, v.n
from exam_cycle c,
(values
  (null,'ALL',17727),
  ('Assistant Section Officer','UR',1200),
  ('Income Tax Inspector','UR',900),
  ('Inspector (CBIC)','OBC',750)
) as v(post,cat,n)
where c.slug='ssc-cgl-2026';

-- Eligibility (engine) -------------------------------------------------------
insert into eligibility (cycle_id, age_min, age_max, age_relaxation, age_as_on, min_qualification, qualification_codes, gender, rules)
select c.id, 18, 32, '{"OBC":3,"SC":5,"ST":5,"PwD":10}'::jsonb, date '2026-08-01',
       'Bachelor''s Degree', array['graduate','any-degree'], 'all',
       '{"nationality":"Indian"}'::jsonb
from exam_cycle c where c.slug='ssc-cgl-2026';

-- Official links -------------------------------------------------------------
insert into official_link (cycle_id, kind, label, url, is_official)
select c.id, 'official_notification','Official Notification (PDF)','https://ssc.gov.in/notice/cgl-2026.pdf', true
from exam_cycle c where c.slug='ssc-cgl-2026';
insert into official_link (cycle_id, kind, label, url, is_official)
select c.id, 'apply_online','Apply Online','https://ssc.gov.in/apply', true
from exam_cycle c where c.slug='ssc-cgl-2026';

-- Update feed item -----------------------------------------------------------
insert into update_feed (cycle_id, exam_id, body_id, kind, title, summary, url_path, importance)
select c.id, c.exam_id, e.conducting_body_id, 'new_notification',
       'SSC CGL 2026 Notification Out — 17,727 Vacancies',
       'Applications open till the last date. Graduate-level posts across ministries.',
       '/ssc/ssc-cgl-2026', 95
from exam_cycle c join exam e on e.id=c.exam_id
where c.slug='ssc-cgl-2026';

-- Refresh search index -------------------------------------------------------
refresh materialized view search_index;
