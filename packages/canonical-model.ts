/* ============================================================================
 * PROJECT DREAM — CANONICAL DATA MODEL  (v1.0)
 * ----------------------------------------------------------------------------
 * The single source of truth for the entire platform. Every scraper, AI agent,
 * Supabase table, Next.js component, SEO tag and notification uses THESE shapes.
 * If a field is not defined here, it does not exist anywhere.
 *
 *   Frontend  : import these types directly (web/lib/canonical).
 *   Backend   : mirror them (Python dataclasses / Pydantic) 1:1.
 *   Database  : Supabase tables are the normalized persistence of these.
 *   Cache     : the pre-built ExamDashboard object (bottom) is what pages read.
 *
 * GOVERNING RULES (Project Dream constitution):
 *   1. Automation-first.               6. Every change is reversible.
 *   2. Every page from structured data 7. SEO-ready by default.
 *   3. No duplicate data.              8. Mobile-first.
 *   4. One source of truth (Supabase). 9. Performance before visual effects.
 *   5. Every update = a new version.  10. Humans only below the confidence gate.
 *
 * KEY MODELLING IDEA:  ConductingBody → Exam (evergreen) → ExamCycle (a year).
 * The ExamCycle is the spine; almost everything time-bound hangs off it and the
 * whole /exam/[slug] dashboard is ONE pre-built object per cycle.
 * ==========================================================================*/

/* ─────────────────────────── Primitives ─────────────────────────── */
export type UUID = string;         // v4 uuid
export type ISODate = string;      // 'YYYY-MM-DD'
export type ISODateTime = string;  // RFC3339
export type Slug = string;         // lowercase-hyphenated, stable forever
export type URLString = string;

/** Every persisted entity carries these. */
export interface Base {
  id: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/* ─────────────────────────── Controlled vocabularies (enums) ───────────────
 * Centralised so scraper, AI, DB and UI never disagree on a string.        */
export type ExamLevel =
  | 'national' | 'state' | 'ssc' | 'banking' | 'railway' | 'defence'
  | 'teaching' | 'police' | 'psu' | 'judiciary' | 'nta' | 'other';

export type CycleStatus =
  | 'upcoming' | 'notification_out' | 'application_open' | 'application_closed'
  | 'admit_card' | 'exam_over' | 'answer_key' | 'result_awaited' | 'result_out'
  | 'cutoff_out' | 'completed' | 'cancelled' | 'postponed';

export type Category = 'UR' | 'OBC' | 'SC' | 'ST' | 'EWS' | 'PwD' | 'ESM' | 'ALL';
export type Gender = 'all' | 'male' | 'female' | 'transgender';

export type DateKind =
  | 'notification' | 'application_start' | 'application_end' | 'fee_last_date'
  | 'correction_start' | 'correction_end' | 'admit_card' | 'exam'
  | 'answer_key' | 'result' | 'interview' | 'dv' | 'medical' | 'other';

export type StageKind =
  | 'prelims' | 'mains' | 'tier1' | 'tier2' | 'tier3' | 'tier4'
  | 'cbt1' | 'cbt2' | 'skill_test' | 'typing_test' | 'physical_test'
  | 'interview' | 'document_verification' | 'medical' | 'final' | 'other';

export type LinkKind =
  | 'official_website' | 'notification_pdf' | 'apply_online' | 'admit_card'
  | 'result' | 'answer_key' | 'syllabus_pdf' | 'cutoff_pdf' | 'previous_paper'
  | 'corrigendum' | 'other';

export type DocumentKind =
  | 'notification' | 'admit_card' | 'result' | 'answer_key' | 'syllabus'
  | 'cutoff' | 'previous_paper' | 'corrigendum' | 'other';

export type UpdateKind =
  | 'new_notification' | 'date_change' | 'admit_card' | 'result'
  | 'answer_key' | 'cutoff' | 'vacancy_change' | 'corrigendum' | 'general';

export type NotificationChannel = 'web_push' | 'email' | 'telegram' | 'whatsapp' | 'in_app';
export type ValidationStatus = 'auto_publish' | 'needs_review' | 'rejected';
export type FollowRole = 'interested' | 'preparing' | 'applied';

/* ═══════════════════════════ A. TAXONOMY / IDENTITY ═══════════════════════ */

/** The organisation that conducts exams (SSC, UPSC, IBPS, RRB, a State PSC…). */
export interface ConductingBody extends Base {
  slug: Slug;                 // 'ssc'  → /ssc
  name: string;               // 'Staff Selection Commission'
  short_name: string;         // 'SSC'
  level: ExamLevel;
  state_code?: string;        // 'MP' for state bodies; null for national
  official_url: URLString;
  logo_url?: URLString;
  overview?: string;          // evergreen "about this body"
  is_active: boolean;
  seo?: SEOMetadata;
}

/** The evergreen exam brand ("SSC CGL"). Holds timeless content + SEO authority. */
export interface Exam extends Base {
  slug: Slug;                 // 'ssc-cgl'
  conducting_body_id: UUID;
  name: string;               // 'SSC Combined Graduate Level'
  short_name: string;         // 'SSC CGL'
  level: ExamLevel;
  qualification_tier: '10th' | '12th' | 'graduate' | 'postgraduate' | 'other';
  overview?: string;          // evergreen description
  tags: string[];
  search_keywords?: string;
  related_exam_ids: UUID[];   // powers "Related Exams" + internal linking
  is_active: boolean;
  seo?: SEOMetadata;
}

/** A specific year/cycle ("SSC CGL 2027"). THE spine of the platform. */
export interface ExamCycle extends Base {
  slug: Slug;                 // 'ssc-cgl-2027'  → /exam/ssc-cgl-2027
  exam_id: UUID;
  year: number;               // 2027
  title: string;              // 'SSC CGL 2027'
  status: CycleStatus;
  notification_no?: string;
  short_summary?: string;     // 1–2 lines for cards + meta description
  is_featured: boolean;
  published_at?: ISODateTime; // null = draft (hidden by RLS)
  // The rich content below is stored in the related entities; this row is the anchor.
}

/* ═══════════════════════════ B. DATES & PROCESS ═══════════════════════════ */

/** A single dated event for a cycle. Drives "Important Dates" + "days left". */
export interface ImportantDate extends Base {
  cycle_id: UUID;
  kind: DateKind;
  label: string;              // 'Last Date to Apply'
  date?: ISODate;             // null = "to be announced"
  end_date?: ISODate;         // for ranges
  is_deadline: boolean;       // feeds countdowns + deadline calendar
  status: 'confirmed' | 'tentative' | 'extended' | 'postponed';
}

/** An ordered milestone for the Timeline component. */
export interface TimelineEvent extends Base {
  cycle_id: UUID;
  order: number;
  title: string;              // 'Tier-1 Exam'
  kind: StageKind | DateKind;
  date?: ISODate;
  done: boolean;              // computed vs today at cache-build time
  note?: string;
}

/** One stage of the selection process (with cut-offs attachable per stage). */
export interface SelectionStage extends Base {
  cycle_id: UUID;
  order: number;
  kind: StageKind;
  name: string;               // 'Tier-2 (Mains)'
  description?: string;
  is_qualifying?: boolean;    // qualifying vs merit-counting
}

/** Exam pattern: sections, marks, duration, negative marking. */
export interface ExamPattern extends Base {
  cycle_id: UUID;
  stage_kind: StageKind;
  sections: {
    name: string;             // 'Quantitative Aptitude'
    questions?: number;
    marks?: number;
    duration_min?: number;
  }[];
  total_marks?: number;
  total_duration_min?: number;
  negative_marking?: string;  // '0.25 per wrong answer'
  mode?: 'online' | 'offline' | 'cbt' | 'omr';
}

/** Syllabus, structured by stage → subject → topics. */
export interface Syllabus extends Base {
  cycle_id?: UUID;            // cycle-specific if syllabus changed…
  exam_id?: UUID;             // …else evergreen at the exam level
  stage_kind?: StageKind;
  subjects: { subject: string; topics: string[] }[];
  source_document_id?: UUID;  // link to the official syllabus PDF
}

/* ═══════════════════════════ C. REQUIREMENTS & OFFER ══════════════════════ */

/** Eligibility — structured for the Eligibility Engine + personalised matching. */
export interface Eligibility extends Base {
  cycle_id?: UUID;
  exam_id?: UUID;             // evergreen fallback
  post_name?: string;
  age_min?: number;
  age_max?: number;
  age_as_on?: ISODate;
  age_relaxation?: Partial<Record<Category, number>>; // {OBC:3, SC:5, …}
  min_qualification?: string; // "Bachelor's Degree"
  qualification_codes: string[];                      // ['graduate','any-degree']
  gender: Gender;
  nationality?: string;       // 'Indian'
  attempts_max?: number;
  domicile?: string;
  notes?: string;
  rules?: Record<string, unknown>; // anything exotic
}

/** Vacancy counts (headline + breakdown) → "Vacancy" + history. */
export interface Vacancy extends Base {
  cycle_id: UUID;
  post_name?: string;         // null = overall
  category?: Category;
  state_code?: string;
  seats: number;
}

/** Application fee by category. */
export interface Fee extends Base {
  cycle_id: UUID;
  category: Category;
  amount: number;             // INR
  currency: 'INR';
  notes?: string;             // 'Women/PwD/ESM exempted', payment mode…
}

/** Salary / pay for a post. */
export interface Salary extends Base {
  cycle_id?: UUID;
  exam_id?: UUID;
  post_name: string;
  pay_level?: string;         // 'Level 7 (7th CPC)'
  pay_min?: number;
  pay_max?: number;
  in_hand_approx?: number;
  grade_pay?: number;
  perks?: string;
}

/* ═══════════════════════════ D. OUTPUTS / ARTIFACTS ═══════════════════════ */

/** The official notification event for a cycle. */
export interface NotificationRecord extends Base {
  cycle_id: UUID;
  title: string;
  notification_no?: string;
  released_on?: ISODate;
  document_id?: UUID;         // the notification PDF
  summary?: string;
}

export interface AdmitCard extends Base {
  cycle_id: UUID;
  stage_kind: StageKind;
  released_on?: ISODate;
  download_from?: ISODate;
  download_till?: ISODate;
  link_id?: UUID;             // OfficialLink to the admit-card portal
  instructions?: string;
}

export interface Result extends Base {
  cycle_id: UUID;
  stage_kind: StageKind;
  declared_on?: ISODate;
  document_id?: UUID;
  link_id?: UUID;
  summary?: string;           // 'X candidates qualified for Tier-2'
}

export interface AnswerKey extends Base {
  cycle_id: UUID;
  stage_kind: StageKind;
  released_on?: ISODate;
  is_provisional: boolean;    // provisional vs final
  objection_till?: ISODate;
  document_id?: UUID;
  link_id?: UUID;
}

/** Cut-off marks per year/stage/category/post → "Cutoff" + trends. */
export interface Cutoff extends Base {
  cycle_id: UUID;
  stage_kind?: StageKind;
  post_name?: string;
  category: Category;
  marks: number;
  max_marks?: number;
}

/** Previous-year question papers (with/without solutions). */
export interface PreviousPaper extends Base {
  exam_id: UUID;
  year: number;
  stage_kind?: StageKind;
  title: string;              // 'SSC CGL 2024 Tier-1 Paper'
  document_id?: UUID;
  has_solution: boolean;
}

/** A stored file (PDF/image). Blob lives in Supabase Storage; row = metadata. */
export interface DocumentFile extends Base {
  cycle_id?: UUID;
  exam_id?: UUID;
  kind: DocumentKind;
  title: string;
  storage_path: string;       // Supabase Storage key
  source_url?: URLString;     // where we scraped it from (provenance)
  mime_type: string;
  pages?: number;
  content_hash: string;       // sha256 → dedupe + change detection
}

/** An outbound official link (the whole point: we route users to the source). */
export interface OfficialLink extends Base {
  cycle_id?: UUID;
  exam_id?: UUID;
  kind: LinkKind;
  label: string;
  url: URLString;
  is_official: boolean;       // true = government/official domain
  active_from?: ISODateTime;  // e.g. apply window opens
  active_to?: ISODateTime;
  last_checked_at?: ISODateTime; // liveness (200 OK) for trust
}

/* ═══════════════════════════ E. CONTENT & DISCOVERY ═══════════════════════ */

export interface FAQ extends Base {
  cycle_id?: UUID;
  exam_id?: UUID;
  question: string;
  answer: string;             // markdown
  order: number;              // also emitted as FAQPage JSON-LD
}

/** The "what changed" feed item — one per meaningful published change. */
export interface Update extends Base {
  cycle_id?: UUID;
  exam_id?: UUID;
  body_id?: UUID;
  kind: UpdateKind;
  title: string;              // 'SSC CGL 2027 last date extended to 30 Aug'
  summary?: string;
  url_path: string;           // canonical internal link
  importance: number;         // 0..100 → ranks homepage feed
  published_at: ISODateTime;
  changed?: Record<string, [unknown, unknown]>; // {last_date:['25 Aug','30 Aug']}
}

/** Per-entity SEO metadata (rule 7: SEO-ready by default). */
export interface SEOMetadata {
  title: string;
  description: string;
  canonical: URLString;
  og_image?: URLString;
  keywords?: string[];
  jsonld?: Record<string, unknown>[]; // JobPosting / Event / FAQPage / BreadcrumbList
  noindex?: boolean;
}

/* ═══════════════════════════ F. GOVERNANCE / PIPELINE ═════════════════════
 * Rules 5 & 6: every update is a new version and every change is reversible. */

/** Immutable snapshot of any entity at a point in time. */
export interface VersionHistory extends Base {
  entity_type: string;        // 'exam_cycle' | 'vacancy' | …
  entity_id: UUID;
  version_no: number;
  snapshot: Record<string, unknown>;               // full serialized entity
  diff: Record<string, [unknown, unknown]>;        // vs previous version
  is_current: boolean;
  source_extraction_id?: UUID;
  validation_id?: UUID;
  created_by: 'pipeline' | string; // 'pipeline' or staff email
}

/** Who/what changed what — full audit trail. */
export interface AuditLog extends Base {
  actor: string;              // 'pipeline' | 'scraper:ssc' | staff email
  action: string;             // 'publish' | 'update' | 'rollback' | 'approve' | 'reject'
  entity_type: string;
  entity_id: UUID;
  detail?: Record<string, unknown>;
}

/** Support tables that implement the automation (not user-facing content). */
export interface RawSource extends Base {          // one scraped snapshot
  body_id?: UUID;
  url: URLString;
  content_hash: string;       // change detection vs last scrape
  storage_path?: string;      // raw HTML/PDF blob
  fetched_at: ISODateTime;
  changed: boolean;
}
export interface Extraction extends Base {          // AI output for a raw source
  raw_source_id: UUID;
  model: string;
  prompt_version: string;
  target_type: string;        // which entity this fills
  payload: Record<string, unknown>;                 // structured JSON candidate
  confidence: number;         // 0..1
}
export interface Validation extends Base {          // the >threshold gate
  extraction_id: UUID;
  score: number;              // 0..100
  status: ValidationStatus;   // auto_publish | needs_review | rejected
  threshold: number;          // default 90
  checks: ValidationCheck[];
  report: string;             // human-readable, sent to Telegram
  reviewed_by?: string;
  reviewed_at?: ISODateTime;
}
export interface ValidationCheck {
  name: string;               // 'date_logic' | 'age_range' | 'vacancy_positive' …
  passed: boolean;
  weight: number;
  severity: 'hard' | 'soft';  // hard failure blocks regardless of score
  detail?: string;
}

/* ═══════════════════════════ G. USER ══════════════════════════════════════ */

export interface User extends Base {
  display_name?: string;
  avatar_url?: string;
  // eligibility profile → personalisation + "relevant" notifications only
  date_of_birth?: ISODate;
  category?: Category;
  gender?: Gender;
  highest_qualification?: string;
  qualification_codes: string[];
  home_state?: string;
}

export interface NotificationPreference extends Base {
  user_id: UUID;
  topic: string;              // 'exam:ssc-cgl' | 'body:ssc' | 'deadline:*'
  channels: NotificationChannel[];
  is_active: boolean;
}

export interface Bookmark extends Base {
  user_id: UUID;
  exam_id?: UUID;
  cycle_id?: UUID;
  role: FollowRole;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE UNIVERSAL EXAM DASHBOARD OBJECT  (the pre-built cache)
 * ---------------------------------------------------------------------------
 * Rule 9 (performance): the /exam/[slug] page must read ONE pre-assembled,
 * denormalised object — NOT run 20 queries per visitor. The pipeline rebuilds
 * this whenever a validated change lands, stores it (Supabase JSONB row and/or
 * Cloudflare KV / ISR), and the page renders straight from it. This is the
 * contract every ExamDashboard React component consumes (section = component).
 * ==========================================================================*/
export interface ExamDashboard {
  // identity + routing
  cycle_id: UUID;
  slug: Slug;                 // 'ssc-cgl-2027'
  url_path: string;           // '/exam/ssc-cgl-2027'
  built_at: ISODateTime;      // cache freshness
  version_no: number;

  body: Pick<ConductingBody, 'slug' | 'name' | 'short_name' | 'official_url' | 'logo_url'>;
  exam: Pick<Exam, 'slug' | 'name' | 'short_name' | 'level'>;

  // 1 Overview / Hero + 2 Quick Facts
  hero: {
    title: string;
    status: CycleStatus;
    year: number;
    overview: string;
    quick_facts: { label: string; value: string }[]; // vacancies, age, qualification, fee…
    next_deadline?: { label: string; date: ISODate; days_left: number };
  };
  // 3 Latest Update  ·  4 Important Dates  ·  5 Timeline
  latest_update?: Pick<Update, 'title' | 'summary' | 'kind' | 'published_at' | 'url_path'>;
  important_dates: Pick<ImportantDate, 'kind' | 'label' | 'date' | 'end_date' | 'is_deadline' | 'status'>[];
  timeline: Pick<TimelineEvent, 'order' | 'title' | 'kind' | 'date' | 'done'>[];
  // 6 Eligibility  ·  7 Vacancy (+ history)  ·  8 Fee  ·  9 Salary
  eligibility: Eligibility[];
  vacancy: { total?: number; breakdown: Pick<Vacancy, 'post_name' | 'category' | 'seats'>[];
             history: { year: number; seats: number }[] };
  fees: Pick<Fee, 'category' | 'amount' | 'notes'>[];
  salary: Pick<Salary, 'post_name' | 'pay_level' | 'pay_min' | 'pay_max' | 'in_hand_approx'>[];
  // 10 Selection Process  ·  11 Exam Pattern  ·  12 Syllabus
  selection: Pick<SelectionStage, 'order' | 'kind' | 'name' | 'is_qualifying'>[];
  pattern: ExamPattern[];
  syllabus?: Pick<Syllabus, 'stage_kind' | 'subjects'>[];
  // 13 Notification/PDF · 14 Admit Card · 15 Result · 16 Answer Key · 17 Cutoff · 18 Papers
  notification?: Pick<NotificationRecord, 'title' | 'notification_no' | 'released_on'> & { pdf?: URLString };
  admit_cards: (Pick<AdmitCard, 'stage_kind' | 'released_on' | 'download_till'> & { url?: URLString })[];
  results: (Pick<Result, 'stage_kind' | 'declared_on' | 'summary'> & { url?: URLString })[];
  answer_keys: (Pick<AnswerKey, 'stage_kind' | 'released_on' | 'is_provisional' | 'objection_till'> & { url?: URLString })[];
  cutoffs: Pick<Cutoff, 'stage_kind' | 'post_name' | 'category' | 'marks' | 'max_marks'>[];
  previous_papers: (Pick<PreviousPaper, 'year' | 'title' | 'has_solution'> & { url?: URLString })[];
  // 19 How to Apply  ·  20 FAQs  ·  21 Related Exams  ·  22 Official Links
  how_to_apply?: string[];    // ordered steps
  faqs: Pick<FAQ, 'question' | 'answer'>[];
  related_exams: { slug: Slug; short_name: string; body_short: string; year: number }[];
  official_links: Pick<OfficialLink, 'kind' | 'label' | 'url' | 'is_official' | 'last_checked_at'>[];

  // baked-in SEO (rule 7)
  seo: SEOMetadata;
}

/* Convenience: a discriminated map of every entity type for generic pipelines. */
export type CanonicalEntity =
  | ConductingBody | Exam | ExamCycle | ImportantDate | TimelineEvent
  | SelectionStage | ExamPattern | Syllabus | Eligibility | Vacancy | Fee | Salary
  | NotificationRecord | AdmitCard | Result | AnswerKey | Cutoff | PreviousPaper
  | DocumentFile | OfficialLink | FAQ | Update | VersionHistory | AuditLog
  | RawSource | Extraction | Validation | User | NotificationPreference | Bookmark;
