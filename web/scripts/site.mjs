// Zero-dependency static renderer for ExamPath.
// Reads data/exams.json + app/globals.css and emits every route as HTML.
// Mirrors the Next.js components in components/ and app/ so the exported
// site matches what `next build` would produce (same markup + class names).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Absolute site origin+path used for canonical/OG/sitemap. On GitHub Pages the
// project site lives under /Exampath/, so the default includes that base. The
// deploy workflow overrides this via the SITE_URL env (configure-pages base_url).
export const SITE_URL = (process.env.SITE_URL || "https://hemantsatishjadhav06-ai.github.io/Exampath").replace(/\/+$/, "");
export const abs = (path = "/") => SITE_URL + (path.startsWith("/") ? path : "/" + path);

// Live AI backend (OpenRouter-powered /ai/ask). Public URL, configurable per
// deploy; the "Ask AI" widget posts to it and falls back to local answers if
// it is unreachable.
export const AI_API = (process.env.AI_API || "https://exampath-api-cq29.onrender.com/ai/ask").trim();
export const DATA = JSON.parse(readFileSync(join(ROOT, "data/exams.json"), "utf8"));
export const CSS = readFileSync(join(ROOT, "app/globals.css"), "utf8");

export const BODIES = Object.fromEntries(DATA.bodies.map((b) => [b.slug, b]));
export const CYCLES = DATA.cycles;
export const byId = (id) => CYCLES.find((c) => c.id === id);

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const STATUS_META = {
  application_open: { cls: "p-open", label: "Applications Open" },
  closing_soon: { cls: "p-soon", label: "Closing Soon" },
  upcoming: { cls: "p-up", label: "Upcoming" },
  admit_card: { cls: "p-admit", label: "Admit Card Out" },
  result_awaited: { cls: "p-admit", label: "Result Awaited" },
  result_out: { cls: "p-result", label: "Result Out" },
  completed: { cls: "p-done", label: "Completed" },
};
const FEED_ICON = {
  date: ["\u{1F4C5}", "var(--amber-soft)"],
  admit: ["\u{1F3AB}", "var(--brand-soft)"],
  new: ["\u{1F195}", "var(--green-soft)"],
  info: ["\u2139\uFE0F", "#eef1f5"],
  result: ["\u{1F3C6}", "var(--green-soft)"],
};

/* ---------- utils ---------- */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function inr(n) {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}
function parseISO(iso) { const [y,m,d] = iso.split("-").map(Number); return { y, m: m - 1, d }; }
export function fmt(iso) { const { y,m,d } = parseISO(iso); return `${String(d).padStart(2,"0")} ${MONTHS[m]} ${y}`; }
export function fmtShort(iso) { const { y,m,d } = parseISO(iso); return `${String(d).padStart(2,"0")} ${MONTHS[m]}`; }
export function dayOf(iso) { return parseISO(iso).d; }
export function monthOf(iso) { return MONTHS[parseISO(iso).m]; }
export function daysLeft(iso) { return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000); }

export function nextDeadline(c) {
  const open = c.dates
    .filter((d) => d.is_deadline && daysLeft(d.date) >= 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return open[0] || c.dates.find((d) => d.is_deadline) || c.dates[0];
}

/* ---------- shared bits ---------- */
export function pill(status) {
  const m = STATUS_META[status] || STATUS_META.upcoming;
  return `<span class="pill ${m.cls}"><span class="dot"></span>${m.label}</span>`;
}

/* Conducting-body emblem ("logo"): a clean monogram badge in the body's brand
   colour — safe (no trademarked artwork) and consistent across the site. */
export function emblem(b, size = 40) {
  const c = (b && b.color) || "#0d9488";
  const t = (b && b.short ? String(b.short) : "?").slice(0, 5);
  const fs = t.length >= 5 ? 8.5 : t.length === 4 ? 10 : t.length === 3 ? 12 : 15;
  return `<span class="emblem" style="--ec:${c};width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.28)}px" role="img" aria-label="${esc((b && b.short) || "")} emblem"><span style="font-size:${fs}px">${esc(t)}</span></span>`;
}

export function examCard(c) {
  const b = BODIES[c.body];
  const dl = c.dates.find((d) => d.is_deadline);
  const dleft = dl ? daysLeft(dl.date) : null;
  const factRight =
    dleft !== null && dleft >= 0
      ? `<div class="f"><b style="color:${dleft <= 7 ? "var(--red)" : "var(--ink)"}">${dleft}d</b><span>${dl.label.includes("Apply") ? "To apply" : "To go"}</span></div>`
      : `<div class="f"><b>&mdash;</b><span>Dates soon</span></div>`;
  return `<div class="xcard">
    <div class="row1">
      ${emblem(b, 42)}
      <div style="min-width:0">
        <h3>${esc(c.exam)}</h3>
        <div class="meta">${esc(b.name.split(" ").slice(0, 3).join(" "))} &middot; ${esc(c.qualification)}</div>
      </div>
      <div style="margin-left:auto">${pill(c.status)}</div>
    </div>
    <div class="facts">
      <div class="f"><b>${inr(c.vacancy)}</b><span>Vacancies</span></div>
      <div class="f"><b>${c.age_min}&ndash;${c.age_max}</b><span>Age</span></div>
      ${factRight}
    </div>
    <div class="cta">
      <a class="btn pri sm" href="/exam/${c.id}/">View Dashboard</a>
      <button class="heart" data-follow="${c.id}" aria-label="Follow this exam" aria-pressed="false">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.35-9.5-8.5C.5 9 2.5 5.5 6 5.5c2 0 3.2 1 4 2.2.8-1.2 2-2.2 4-2.2 3.5 0 5.5 3.5 3.5 7C19 16.65 12 21 12 21z"/></svg>
      </button>
    </div>
  </div>`;
}

function feedItem(cycleId, title, text, kind, when) {
  const ic = FEED_ICON[kind] || FEED_ICON.info;
  return `<a class="it" href="/exam/${cycleId}/">
    <div class="ic" style="background:${ic[1]}">${ic[0]}</div>
    <div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>
    <div class="t">${esc(when)}</div>
  </a>`;
}

function bodyCard(b) {
  const n = CYCLES.filter((c) => c.body === b.slug).length;
  return `<a class="bcard" href="/body/${b.slug}/">
    ${emblem(b, 52)}
    <b>${b.short}</b><span>${n} exam${n !== 1 ? "s" : ""} &middot; ${esc(b.level)}</span>
    ${b.description ? `<p class="bdesc">${esc(b.description)}</p>` : ""}
  </a>`;
}

/* Category of a conducting body (curated `category`, else inferred from level). */
export function bodyCategory(b) {
  if (b.category) return b.category;
  const l = String(b.level || "").toLowerCase();
  if (l.startsWith("central")) return "central";
  if (l.startsWith("bank")) return "banking";
  if (l.startsWith("rail")) return "railways";
  return "state";
}
const CATEGORY_META = {
  central: { icon: "🏛️", title: "Central Government exams", blurb: "All-India recruitment by central bodies — UPSC, SSC and more." },
  state: { icon: "🗺️", title: "State Government exams", blurb: "State public service commissions — PCS, state services and subordinate posts." },
  banking: { icon: "🏦", title: "Banking exams", blurb: "Public-sector bank recruitment — PO, Clerk and specialist officers." },
  railways: { icon: "🚆", title: "Railway exams", blurb: "Indian Railways recruitment boards — NTPC, Group D and technical posts." },
};

/* Central / State / Banking / Railways blocks with described conducting bodies. */
function categoryBlocks({ withExams = false } = {}) {
  const order = ["central", "state", "banking", "railways"];
  const byCat = {};
  DATA.bodies.forEach((b) => { (byCat[bodyCategory(b)] ||= []).push(b); });
  return order.filter((k) => byCat[k]?.length).map((k) => {
    const m = CATEGORY_META[k];
    const bodies = byCat[k];
    const exams = CYCLES.filter((c) => bodies.some((b) => b.slug === c.body));
    // State block: browse by STATE (all 28 + UTs), live states first (brief §4).
    const stateStrip = k === "state" ? `
      <div class="sec-title" style="margin-top:14px"><h4 class="small" style="font-weight:800">Browse by state</h4><a href="/states/">All states &rarr;</a></div>
      <div class="chips">${STATES.slice().sort((a, z) => ((z.bodies || []).length) - ((a.bodies || []).length))
        .map((s) => `<a class="c ${(s.bodies || []).length ? "" : "c-soon"}" href="/state/${s.slug}/">${esc(s.name)}${(s.bodies || []).length ? "" : " ·soon"}</a>`).join("")}</div>` : "";
    return `<section class="blk cat-block" aria-label="${esc(m.title)}">
      <div class="cat-head">
        <span class="cat-ic">${m.icon}</span>
        <div><h3>${m.title} <span class="tag" style="margin-left:6px">${exams.length} exam${exams.length !== 1 ? "s" : ""}</span></h3>
        <p class="small muted">${m.blurb}</p></div>
      </div>
      <div class="body-grid">${bodies.map(bodyCard).join("")}</div>
      ${stateStrip}
      ${withExams && exams.length ? `<div class="exam-grid" style="margin-top:12px">${exams.map(examCard).join("")}</div>` : ""}
    </section>`;
  }).join("");
}

/* A latest-update row with the conducting-body badge (focal update text). */
function updateRow(f) {
  const c = byId(f.cycleId);
  if (!c) return "";
  const b = BODIES[c.body];
  const ic = FEED_ICON[f.kind] || FEED_ICON.info;
  return `<a class="uprow" href="/exam/${c.id}/">
    <span class="up-badge" style="background:${b.color}1a;color:${b.color}" title="${esc(b.short)}">${b.short}</span>
    <span class="up-main"><b>${esc(f.text)}</b><small>${esc(f.title)} &middot; ${esc(f.when)}</small></span>
    <span class="up-ic" aria-hidden="true">${ic[0]}</span>
  </a>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `<footer class="foot">
    <div class="foot-grid">
      <div>
        <div class="foot-logo"><span class="glyph"> E</span><b>Exam</b><i>Path</i></div>
        <p class="small muted" style="margin:8px 0 0;max-width:320px">Every Indian government exam &mdash; notifications, deadlines, vacancies, eligibility and results, in one fast, free place.</p>
      </div>
      <div class="foot-cols">
        <div><h4>Explore</h4><a href="/notifications/">Notifications</a><a href="/admit-cards/">Admit cards</a><a href="/results/">Results</a><a href="/calendar/">Calendar</a></div>
        <div><h4>Exams</h4><a href="/bodies/">All exams</a><a href="/search/">Search</a>${DATA.bodies.slice(0,3).map((b)=>`<a href="/body/${b.slug}/">${b.short}</a>`).join("")}</div>
        <div><h4>About</h4><a href="/about/">About</a><a href="/faq/">FAQ</a><a href="/contact/">Contact</a><a href="/disclaimer/">Disclaimer</a></div>
      </div>
    </div>
    <div class="foot-base small">
      <span>&copy; ${year} ExamPath &middot; Data compiled from official sources &mdash; always verify on the official website. Not a government website.</span>
    </div>
  </footer>`;
}

const whenRank = (when) => {
  const m = when.match(/(\d+)\s*([hdmw])/i);
  if (!m) return 9999;
  const n = parseInt(m[1], 10), u = m[2].toLowerCase();
  return n * (u === "h" ? 1 / 24 : u === "w" ? 7 : 1);
};
function latestUpdates(limit = 8) {
  const items = [];
  for (const c of CYCLES) for (const u of c.updates)
    items.push({ cycleId: c.id, title: c.exam, text: u.text, kind: u.kind, when: u.when });
  return items.sort((a, b) => whenRank(a.when) - whenRank(b.when)).slice(0, limit);
}

/* ---------- layout ---------- */
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  exams: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

/* ---------- structured data (JSON-LD) ---------- */
function ld(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}
function websiteLD() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ExamPath",
    url: abs("/"),
    description: "Track every Indian government exam — notifications, deadlines, vacancies, eligibility and results.",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: abs("/search/?q={query}") },
      "query-input": "required name=query",
    },
  };
}
function orgLD() {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "ExamPath",
    url: abs("/"),
    logo: abs("/favicon.svg"),
    description: "A free, student-first tracker for Indian government exams.",
  };
}
function breadcrumbLD(items) {
  if (!items || items.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

/* ---------- AI assistant widget (client-powered, works on static hosting) ---------- */
function aiWidget() {
  const prompts = [
    "🎯 Find my exam (consult)",
    "Which exams close this week?",
    "Graduate exams I can apply for",
    "Banking exams",
  ];
  return `<button id="aiFab" class="ai-fab" aria-label="Ask ExamPath AI" title="Ask ExamPath AI">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9H3l2.3-2.3A9 9 0 0 1 12 3Z"/><circle cx="8.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none"/></svg>
    <span>Ask AI</span>
  </button>
  <div id="aiPanel" class="ai-panel" role="dialog" aria-label="ExamPath AI assistant" aria-modal="false" hidden>
    <div class="ai-head">
      <div class="ai-id"><span class="ai-dot"></span><b>ExamPath AI</b><small>your exam guide</small></div>
      <button id="aiClose" class="ai-x" aria-label="Close assistant">&times;</button>
    </div>
    <div id="aiLog" class="ai-log" aria-live="polite">
      <div class="ai-msg bot">Hi! 👋 Ask me about deadlines, eligibility, or which exams fit you. Try one:</div>
      <div class="ai-quick">${prompts.map((p) => `<button class="ai-chip" data-q="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    </div>
    <form id="aiForm" class="ai-input">
      <input id="aiText" autocomplete="off" placeholder="Ask anything about govt exams…" aria-label="Ask the assistant">
      <button class="ai-send" aria-label="Send">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>
      </button>
    </form>
  </div>`;
}

export function layout({ title, description, body, active = "/", jsonld = [], path = "/", breadcrumbs = null, embedData = true }) {
  const navItem = (href, label, base) =>
    `<a href="${href}" class="${active === base ? "active" : ""}">${label}</a>`;
  const tabItem = (href, label, base, icon) =>
    `<a href="${href}" class="${active === base ? "active" : ""}">${icon}${label}</a>`;
  // Embed only the fields the client (AI assistant + search) needs, so every
  // page stays light for sub-second loads at scale.
  const compactCycles = CYCLES.map((c) => ({
    id: c.id, exam: c.exam, title: c.title, body: c.body, status: c.status,
    vacancy: c.vacancy, qualification: c.qualification, qualification_code: c.qualification_code,
    age_min: c.age_min, age_max: c.age_max, summary: c.summary, posts: c.posts,
    dates: (c.dates || []).map((d) => ({ label: d.label, date: d.date, is_deadline: d.is_deadline })),
  }));
  const dataScript = embedData
    ? `<script id="exampath-data" type="application/json">${JSON.stringify({
        bodies: BODIES,
        cycles: compactCycles,
        now: Date.now(),
      }).replace(/</g, "\\u003c")}</script>`
    : "";
  const pageLD = Array.isArray(jsonld) ? jsonld : (jsonld ? [jsonld] : []);
  const ldBlocks = [websiteLD(), orgLD(), breadcrumbLD(breadcrumbs), ...pageLD.map((x) => (typeof x === "string" ? null : x))]
    .filter(Boolean).map(ld).join("\n");
  const rawLD = pageLD.filter((x) => typeof x === "string")
    .map((s) => `<script type="application/ld+json">${s}</script>`).join("\n");
  const canonical = abs(path);
  const ogImage = abs("/og.svg");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#1d4ed8">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/favicon.svg">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:site_name" content="ExamPath">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="preload" as="style" href="/assets/styles.css">
<link rel="stylesheet" href="/assets/styles.css">
${ldBlocks}
${rawLD}
</head>
<body>
<a class="skip" href="#app">Skip to content</a>
<header class="top">
  <div class="wrap bar">
    <a class="logo" href="/" aria-label="ExamPath home"><span class="glyph"> E</span><span><b>Exam</b><i>Path</i></span></a>
    <nav class="navlinks" aria-label="Primary">
      ${navItem("/", "Home", "/")}
      ${navItem("/notifications/", "Notifications", "/notifications")}
      ${navItem("/admit-cards/", "Admit Card", "/admit-cards")}
      ${navItem("/results/", "Result", "/results")}
      ${navItem("/calendar/", "Calendar", "/calendar")}
      ${navItem("/bodies/", "All Exams", "/bodies")}
      ${navItem("/search/", "Check Eligibility", "/search")}
    </nav>
    <div class="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="topSearch" placeholder="Search exams, e.g. SSC, age 21, graduate\u2026" aria-label="Search exams">
    </div>
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode" title="Toggle theme">
      <svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>
      <svg class="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
    </button>
    <button class="btn-login" id="loginBtn" aria-haspopup="dialog">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
      <span id="loginLabel">Login</span>
    </button>
  </div>
</header>

<main id="app">${body}</main>

<nav class="tabbar" aria-label="Mobile">
  ${tabItem("/", "Home", "/", ICONS.home)}
  ${tabItem("/bodies/", "Exams", "/bodies", ICONS.exams)}
  ${tabItem("/calendar/", "Calendar", "/calendar", ICONS.cal)}
  ${tabItem("/search/", "Search", "/search", ICONS.search)}
</nav>

${aiWidget()}

<div id="loginOverlay" class="lg-overlay" hidden>
  <div class="lg-modal" role="dialog" aria-modal="true" aria-labelledby="lgTitle">
    <button class="ai-x lg-x" id="lgClose" aria-label="Close">&times;</button>
    <div class="lg-head">
      <span class="glyph"> E</span>
      <h3 id="lgTitle">Welcome to ExamPath</h3>
      <p class="small muted">Save your exams &amp; get a personalised dashboard.</p>
    </div>
    <div class="lg-tabs"><button class="on" data-lg="login">Login</button><button data-lg="register">Create account</button></div>
    <form id="lgForm" class="lg-form">
      <div class="lg-field lg-name" hidden><label for="lgName">Name</label><input id="lgName" autocomplete="name" placeholder="Your name"></div>
      <div class="lg-field"><label for="lgEmail">Email</label><input id="lgEmail" type="email" autocomplete="email" required placeholder="you@example.com"></div>
      <div class="lg-field"><label for="lgPass">Password</label><input id="lgPass" type="password" autocomplete="current-password" required minlength="8" placeholder="••••••••"></div>
      <div class="lg-err" id="lgErr" role="alert" hidden></div>
      <button class="btn pri" id="lgSubmit" type="submit" style="width:100%">Login</button>
      <p class="small muted" style="text-align:center;margin:10px 0 0">Free forever · your data stays yours</p>
    </form>
    <div class="lg-in" id="lgSignedIn" hidden>
      <p style="margin:0 0 12px">Signed in as <b id="lgWho"></b></p>
      <button class="btn ghost" id="lgLogout" style="width:100%">Log out</button>
    </div>
  </div>
</div>

<div id="toast" role="status" style="position:fixed;bottom:84px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;padding:11px 18px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--sh-l);z-index:80;opacity:0;transition:.25s;pointer-events:none;max-width:90vw;text-align:center"></div>
${dataScript}
<script>window.__AI_API__=${JSON.stringify(AI_API)};</script>
<script src="/assets/client.js" defer></script>
</body>
</html>`;
}

/* ---------- HOME ---------- */
export function renderHome() {
  const soon = CYCLES
    .filter((c) => c.dates.some((d) => d.is_deadline && daysLeft(d.date) >= 0))
    .map((c) => ({
      c,
      d: c.dates
        .filter((x) => x.is_deadline && daysLeft(x.date) >= 0)
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0],
    }))
    .sort((a, b) => new Date(a.d.date) - new Date(b.d.date));
  const featured = ["ssc-cgl-2026","upsc-cse-2026","ibps-po-2026","ssc-chsl-2026","rrb-ntpc-2026","mppsc-ss-2026"]
    .map(byId).filter(Boolean);
  const totalVac = CYCLES.reduce((s, c) => s + c.vacancy, 0);

  const body = `
  <section class="hero">
    <div class="wrap hero-center">
      <span class="eyebrow">\u{1F1EE}\u{1F1F3} ${CYCLES.length} live exams &middot; ${Object.keys(BODIES).length} bodies &middot; updated daily</span>
      <h1>Every government exam. <span class="u">Every date.</span> One place.</h1>
      <p class="sub">Notifications, deadlines, vacancies, eligibility, cut-offs and results &mdash; compiled from official sources, in one clean, free place built for students.</p>
      <form class="searchbig" action="/search/" method="get">
        <input id="heroSearch" name="q" placeholder="Search an exam, e.g. \u201cSSC CGL\u201d, \u201cgraduate\u201d, or \u201cbank exams\u201d\u2026" aria-label="Search exams">
        <button class="btn pri" type="submit">Search</button>
      </form>
      <div class="chips">
        <a class="c" href="/search/?q=graduate">\u{1F393} Graduate exams</a>
        <a class="c" href="/search/?q=12th">\u{1F4D7} 12th pass</a>
        <a class="c" href="/search/?q=banking">\u{1F3E6} Banking</a>
        <a class="c" href="/notifications/">\u{1F514} Open notifications</a>
        <a class="c" href="/search/?q=closing%20soon">\u23F0 Closing soon</a>
      </div>
      <div class="hero-stats">
        <div class="s"><b>${inr(totalVac)}+</b><span>Vacancies tracked</span></div>
        <div class="s"><b>${CYCLES.length}</b><span>Live exams</span></div>
        <div class="s"><b>${Object.keys(BODIES).length}</b><span>Conducting bodies</span></div>
        <div class="s"><b>5 yr</b><span>Year-wise records</span></div>
      </div>
    </div>
  </section>

  <div class="wrap pull">
    <!-- 1. Closing dates / urgent countdowns -->
    <section class="blk" aria-labelledby="h-closing">
      <div class="sec-title"><h2 id="h-closing">\u23F0 Closing soon</h2><a href="/calendar/">Full calendar &rarr;</a></div>
      <div class="dl-strip">
        ${soon.map(({ c, d }) => `
          <a class="dl-card" href="/exam/${c.id}/">
            <div class="cd" data-countdown="${d.date}">${daysLeft(d.date)}<small> days left</small></div>
            <h4>${esc(c.title)}</h4>
            <div class="small muted">${esc(d.label)} &middot; ${fmt(d.date)}</div>
          </a>`).join("")}
      </div>
    </section>

    <!-- 2. Latest updates (focal), each tagged with its exam badge -->
    <section class="blk" aria-labelledby="h-updates">
      <div class="sec-title"><h2 id="h-updates">\u{1F195} Latest updates</h2><a href="/notifications/">All notifications &rarr;</a></div>
      ${(() => {
        const all = latestUpdates(24);
        const isAdmit = (u) => u.kind === "admit" || /admit card|hall ticket|exam city/i.test(u.text);
        const isResult = (u) => u.kind === "result" || /result|answer key|score ?card|merit list/i.test(u.text);
        const seg = {
          all: all.slice(0, 8),
          admit: all.filter(isAdmit).slice(0, 8),
          result: all.filter(isResult).slice(0, 8),
          notif: all.filter((u) => !isAdmit(u) && !isResult(u)).slice(0, 8),
        };
        const pane = (key, items, empty) => `<div class="updates-grid" data-upd-pane="${key}" ${key !== "all" ? "hidden" : ""}>
          ${items.length ? items.map(updateRow).join("") : `<div class="card" style="padding:22px;text-align:center;grid-column:1/-1"><p class="muted">${empty}</p></div>`}</div>`;
        return `<div class="upd-tabs" role="tablist" aria-label="Update type">
            <button class="ut on" role="tab" aria-selected="true" data-upd="all">All</button>
            <button class="ut" role="tab" aria-selected="false" data-upd="notif">\u{1F514} Notifications</button>
            <button class="ut" role="tab" aria-selected="false" data-upd="admit">\u{1F3AB} Admit Card</button>
            <button class="ut" role="tab" aria-selected="false" data-upd="result">\u{1F3C6} Result</button>
          </div>
          ${pane("all", seg.all, "No updates yet.")}
          ${pane("notif", seg.notif, "No new notifications right now.")}
          ${pane("admit", seg.admit, "No admit-card updates right now.")}
          ${pane("result", seg.result, "No result updates right now.")}`;
      })()}
    </section>

    <!-- 3. Conducting bodies — Central, then State, then Banking/Railways -->
    <section class="blk" aria-labelledby="h-bodies">
      <div class="sec-title"><h2 id="h-bodies">Conducting bodies</h2><a href="/bodies/">Browse all &rarr;</a></div>
      ${categoryBlocks()}
    </section>

    <!-- 4. Popular exams -->
    <section class="blk" aria-labelledby="h-popular">
      <div class="sec-title"><h2 id="h-popular">Popular exams</h2><a href="/bodies/">Browse all &rarr;</a></div>
      <div class="exam-grid">${featured.map(examCard).join("")}</div>
    </section>
    ${footer()}
  </div>`;

  return layout({
    title: "ExamPath \u2014 Every government exam. Every date. One place.",
    description:
      "Track every Indian government exam (SSC, UPSC, IBPS, RRB, state PSCs) \u2014 notifications, deadlines, vacancies, eligibility and results, compiled from official sources.",
    body,
    active: "/",
    path: "/",
  });
}

/* ---------- BODIES INDEX ---------- */
export function renderBodies() {
  const body = `<section class="page"><div class="wrap">
    <div class="crumb"><a href="/">Home</a> \u203A <span>All exams</span></div>
    <div class="sec-title"><h1 class="page-title">Browse exams by category &amp; conducting body</h1></div>
    ${categoryBlocks({ withExams: true })}
    ${footer()}
  </div></section>`;
  return layout({
    title: "All Government Exams & Conducting Bodies | ExamPath",
    description:
      "Browse every tracked Indian government exam by conducting body \u2014 SSC, UPSC, IBPS, RRB and state PSCs \u2014 with live dates, vacancies and eligibility.",
    body,
    active: "/bodies",
    path: "/bodies/",
    breadcrumbs: [{ name: "Home", path: "/" }, { name: "All exams", path: "/bodies/" }],
  });
}

/* ---------- CONDUCTING BODY ---------- */
export function renderBody(slug) {
  const b = BODIES[slug];
  const list = CYCLES.filter((c) => c.body === slug);
  const groups = {
    "Current / Open": list.filter((c) => ["application_open","closing_soon","admit_card"].includes(c.status)),
    Upcoming: list.filter((c) => c.status === "upcoming"),
    "Results & Past": list.filter((c) => ["result_awaited","result_out","completed"].includes(c.status)),
  };
  const monthHas = {};
  list.forEach((c) => c.dates.forEach((d) => { monthHas[parseISO(d.date).m] = true; }));
  const updates = list.flatMap((c) => c.updates.map((u) => ({ ...u, to: c.id, title: c.exam }))).slice(0, 5);
  const totalVac = list.reduce((s, c) => s + c.vacancy, 0);

  const body = `<section class="page"><div class="wrap">
    <div class="crumb"><a href="/">Home</a> \u203A <a href="/bodies/">Exams</a> \u203A <span>${b.short}</span></div>
    <div class="dash-hero" style="background:linear-gradient(135deg,${b.color},${shade(b.color, -24)})">
      <div class="body-tag">${esc(b.level)} &middot; Conducting Body</div>
      <h1>${esc(b.name)}</h1>
      ${b.description ? `<p style="color:#e6eefc;margin:8px 0 0;max-width:640px">${esc(b.description)}</p>` : ""}
      <p style="color:#e6eefc;margin:6px 0 0;max-width:560px;opacity:.85">Tracking ${list.length} exam${list.length > 1 ? "s" : ""} &middot; ${inr(totalVac)} vacancies. Current openings, calendar and the latest official updates.</p>
    </div>
    <div class="dash-grid">
      <div>
        ${Object.entries(groups).map(([g, arr]) => arr.length ? `
          <div class="panel">
            <h3>${g} <span class="tag" style="margin-left:6px">${arr.length}</span></h3>
            <div class="exam-grid" style="margin-top:12px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${arr.map(examCard).join("")}</div>
          </div>` : "").join("")}
      </div>
      <div>
        <div class="panel">
          <h3>\u{1F4C5} Exam calendar</h3>
          <div class="months">
            ${MONTHS.map((m, i) => `<div class="m ${monthHas[i] ? "has" : ""}"><b>${m}</b><span>${monthHas[i] ? "\u25CF" : "&nbsp;"}</span></div>`).join("")}
          </div>
          <p class="small muted" style="margin:6px 0 0">Highlighted months have scheduled dates.</p>
        </div>
        <div class="panel">
          <h3>\u{1F514} Latest updates</h3>
          <div class="feed">${updates.map((u) => feedItem(u.to, u.title, u.text, u.kind, u.when)).join("")}</div>
        </div>
        <div class="panel">
          <h3>\u{1F517} Official website</h3>
          <a class="src" href="${esc(b.official_url)}" target="_blank" rel="noopener">
            <div class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></div>
            <div><b>${esc(b.name)}</b><br><span>${esc(b.official_url.replace(/^https?:\/\//, ""))}</span></div><span class="go">Open \u2197</span>
          </a>
        </div>
      </div>
    </div>
    ${footer()}
  </div></section>`;

  return layout({
    title: `${b.short} \u2014 ${b.name}: Exams, Dates & Vacancies | ExamPath`,
    description: `All ${b.short} (${b.name}) exams tracked on ExamPath \u2014 ${list.length} exam${list.length > 1 ? "s" : ""}, ${inr(totalVac)} vacancies. Notifications, deadlines and eligibility.`,
    body,
    active: "/bodies",
    path: `/body/${slug}/`,
    breadcrumbs: [{ name: "Home", path: "/" }, { name: "Exams", path: "/bodies/" }, { name: b.short, path: `/body/${slug}/` }],
  });
}

/* ---------- EXAM DASHBOARD (tabbed) ---------- */
function officialLink(c, b, kind) {
  const l = (c.links || []).find((x) => String(x.kind).toLowerCase() === kind) || (c.links || [])[0];
  return l ? l.url : (b.official_url || "#");
}
function srcRow(l) {
  return `<a class="src" href="${esc(l.url)}" target="_blank" rel="noopener">
    <div class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></div>
    <div><b>${esc(l.label)}</b><br><span>${esc(l.kind)} &middot; official</span></div><span class="go">Open \u2197</span></a>`;
}
function officialNote(b, url) {
  return `<div class="ofnote"><span>\uD83D\uDD17</span> Always verify on the official website:
    <a href="${esc(url)}" target="_blank" rel="noopener">${esc(String(url).replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></div>`;
}

/* Pattern & Syllabus tab */
function patternPanel(c, b) {
  const pat = c.exam_pattern || [];
  const syl = c.syllabus || [];
  if (!pat.length && !syl.length) return "";
  const patHtml = pat.map((p) => `
    <div class="pat-card">
      <div class="pat-head">
        <h4>${esc(p.stage)}</h4>
        <div class="pat-meta">
          ${p.mode ? `<span class="tag">\uD83D\uDDA5 ${esc(p.mode)}</span>` : ""}
          ${p.duration_min ? `<span class="tag">\u23F1 ${p.duration_min} min</span>` : ""}
          ${p.total_marks ? `<span class="tag">\uD83C\uDFAF ${p.total_marks} marks</span>` : ""}
          ${p.negative_marking ? `<span class="tag t-red">\u2212 ${esc(p.negative_marking)}</span>` : ""}
        </div>
      </div>
      ${p.sections && p.sections.length ? `
      <div class="tbl-scroll"><table class="dtable">
        <tbody><tr><th>Section</th><th>Questions</th><th>Marks</th></tr>
        ${p.sections.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td>${s.questions ?? "\u2014"}</td><td>${s.marks ?? "\u2014"}</td></tr>`).join("")}
        <tr class="tot"><td><b>Total</b></td><td><b>${p.sections.reduce((x, s) => x + (s.questions || 0), 0)}</b></td><td><b>${p.sections.reduce((x, s) => x + (s.marks || 0), 0)}</b></td></tr>
        </tbody></table></div>` : ""}
      ${p.note ? `<p class="small muted" style="margin:8px 0 0">${esc(p.note)}</p>` : ""}
    </div>`).join("");
  const sylHtml = syl.map((sg) => `
    <div class="syl-stage">
      <h4>${esc(sg.stage)} syllabus</h4>
      ${(sg.subjects || []).map((s) => `
        <details class="faq-item syl-subject"><summary>${esc(s.subject)} <span class="tag" style="margin-left:6px">${(s.topics || []).length} topics</span></summary>
          <div class="topic-chips">${(s.topics || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
        </details>`).join("")}
    </div>`).join("");
  return `
    ${pat.length ? `<div class="panel"><h3>\uD83D\uDCDD Exam pattern <span class="small muted" style="font-weight:600;margin-left:auto">how the exam is timed &amp; marked</span></h3>${patHtml}</div>` : ""}
    ${syl.length ? `<div class="panel"><h3>\uD83D\uDCDA Syllabus</h3>${sylHtml}</div>` : ""}
    ${officialNote(b, officialLink(c, b, "notification"))}`;
}

/* Cut-offs & Results tab (year-wise, no confusion) */
function cutoffsPanel(c, b) {
  const years = c.yearwise && c.yearwise.length ? c.yearwise
    : (c.vacancy_history || []).map((v) => ({
        year: v.year, vacancy: v.seats,
        cutoff_ur: v.year === Math.max(...c.vacancy_history.map((x) => x.year)) ? (c.cutoffs?.[0]?.marks ?? null) : null,
        result_status: v.year < 2026 ? "declared" : "upcoming",
        result_url: b.official_url,
      }));
  const stPill = (s) => s === "declared"
    ? '<span class="pill p-result"><span class="dot"></span>Declared</span>'
    : s === "awaited" ? '<span class="pill p-admit"><span class="dot"></span>Awaited</span>'
    : '<span class="pill p-up"><span class="dot"></span>Upcoming</span>';
  return `
    <div class="panel">
      <h3>\uD83D\uDCCA Year-wise summary <span class="small muted" style="font-weight:600;margin-left:auto">vacancies \u00B7 cut-off \u00B7 result</span></h3>
      <div class="tbl-scroll"><table class="dtable yearwise">
        <tbody><tr><th>Year</th><th>Vacancies</th><th>UR cut-off</th><th>Result</th><th>Official</th></tr>
        ${years.slice().sort((a, z) => z.year - a.year).map((y) => `<tr>
          <td><b>${y.year}</b></td>
          <td>${y.vacancy != null ? inr(y.vacancy) : "\u2014"}</td>
          <td>${y.cutoff_ur != null ? y.cutoff_ur : "\u2014"}</td>
          <td>${stPill(y.result_status)}</td>
          <td><a class="oflink" href="${esc(y.result_url || b.official_url)}" target="_blank" rel="noopener">Check \u2197</a></td>
        </tr>`).join("")}
        </tbody></table></div>
      <p class="small muted" style="margin:10px 0 0">Every row links to the official site \u2014 results are only final there.</p>
    </div>
    ${c.cutoffs && c.cutoffs.length ? `
    <div class="panel">
      <h3>\u2702\uFE0F Latest category cut-offs</h3>
      <div class="tbl-scroll"><table class="dtable"><tbody><tr><th>Category</th><th>Cut-off</th><th></th></tr>
        ${c.cutoffs.map((o) => `<tr><td><b>${esc(o.category)}</b></td><td>${o.marks}</td><td style="width:55%"><div style="height:8px;border-radius:6px;background:var(--brand-soft)"><div style="height:8px;border-radius:6px;width:${Math.min(100, (o.marks / Math.max(...c.cutoffs.map((x) => x.marks))) * 100)}%;background:var(--brand)"></div></div></td></tr>`).join("")}
      </tbody></table></div>
    </div>` : ""}
    ${officialNote(b, officialLink(c, b, "website"))}`;
}

/* How to Apply tab */
function applyPanel(c, b) {
  const has = (x) => Array.isArray(x) && x.length;
  if (!has(c.how_to_apply) && !has(c.fees) && !has(c.salary) && !has(c.faqs)) return "";
  return `
    ${has(c.how_to_apply) ? `<div class="panel"><h3>\uD83D\uDE80 How to apply</h3>
      <ol class="steps">${c.how_to_apply.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <a class="btn saf" style="margin-top:10px" href="${esc(officialLink(c, b, "apply"))}" target="_blank" rel="noopener">Apply on the official site \u2197</a></div>` : ""}
    ${has(c.fees) ? `<div class="panel"><h3>\uD83D\uDCB3 Application fee</h3>
      <div class="tbl-scroll"><table class="dtable"><tbody><tr><th>Category</th><th>Fee</th><th>Notes</th></tr>
      ${c.fees.map((f) => `<tr><td><b>${esc(f.category)}</b></td><td>${f.amount ? "\u20B9" + inr(f.amount) : "Free"}</td><td class="small muted">${esc(f.notes || "")}</td></tr>`).join("")}
      </tbody></table></div></div>` : ""}
    ${has(c.salary) ? `<div class="panel"><h3>\uD83D\uDCB0 Salary by post</h3>
      <div class="tbl-scroll"><table class="dtable"><tbody><tr><th>Post</th><th>Pay level</th><th>Pay scale</th><th>In-hand*</th></tr>
      ${c.salary.map((s) => `<tr><td><b>${esc(s.post)}</b></td><td>${esc(s.pay_level || "\u2014")}</td><td>\u20B9${inr(s.pay_min)}\u2013\u20B9${inr(s.pay_max)}</td><td>${s.in_hand_approx ? "\u2248 \u20B9" + inr(s.in_hand_approx) : "\u2014"}</td></tr>`).join("")}
      </tbody></table></div><p class="small muted" style="margin:8px 0 0">*Approximate, varies by city &amp; allowances.</p></div>` : ""}
    ${has(c.faqs) ? `<div class="panel"><h3>\u2753 FAQs</h3>
      <div class="faq">${c.faqs.map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div></div>` : ""}
    ${officialNote(b, officialLink(c, b, "apply"))}`;
}

/* One stage row: label · date · the RIGHT action button, computed from the
   stage type and today's date (brief §2) — data-driven, no per-exam code.
   - apply-start  -> "Apply" link while the window is open, else state chip
   - deadline     -> live "X days left" countdown chip (or "Closed")
   - release item (admit card / answer key / result) -> "Download" once due,
                    greyed "Expected <Mon>" before
   - exam date    -> countdown, then "Exam held"                              */
function stageRow(d, c, b) {
  const dlft = daysLeft(d.date);
  const label = d.label.toLowerCase();
  const isApplyStart = /application start|apply online|registration start/.test(label);
  const isRelease = /admit card|answer key|result|score ?card|merit list|hall ticket/.test(label);
  const isExam = /exam|tier|phase|cbt|prelim|main/.test(label) && !d.is_deadline && !isRelease;
  const url = d.url || (isRelease ? officialLink(c, b, "website") : officialLink(c, b, "apply"));

  let action;
  if (d.is_deadline) {
    action = dlft < 0 ? `<span class="st-chip st-done">Closed</span>`
      : `<span class="st-chip st-count" data-daysleft="${d.date}" data-deadline="1">${dlft === 0 ? "Today" : dlft + " days left"}</span>`;
  } else if (isApplyStart) {
    const lastDate = c.dates.find((x) => x.is_deadline);
    const open = dlft <= 0 && (!lastDate || daysLeft(lastDate.date) >= 0);
    action = open
      ? `<a class="st-btn st-apply" href="${esc(url)}" target="_blank" rel="noopener">Apply ↗</a>`
      : dlft > 0 ? `<span class="st-chip st-wait">Opens ${fmtShort(d.date)}</span>`
      : `<span class="st-chip st-done">Closed</span>`;
  } else if (isRelease) {
    action = dlft <= 0
      ? `<a class="st-btn st-dl" href="${esc(url)}" target="_blank" rel="noopener">Download ↗</a>`
      : `<span class="st-chip st-wait">Expected ${fmtShort(d.date)}</span>`;
  } else if (isExam) {
    action = dlft < 0 ? `<span class="st-chip st-done">Exam held</span>`
      : `<span class="st-chip st-count" data-daysleft="${d.date}" data-deadline="0">${dlft === 0 ? "Today" : dlft + " days left"}</span>`;
  } else {
    action = dlft < 0 ? `<span class="st-chip st-done">Done</span>`
      : `<span class="st-chip st-count" data-daysleft="${d.date}" data-deadline="0">${dlft === 0 ? "Today" : dlft + " days"}</span>`;
  }
  const hot = d.is_deadline && dlft >= 0 && dlft <= 7;
  return `<div class="kd">
      <div class="date" style="${hot ? "background:var(--red-soft);color:var(--red)" : ""}"><b>${dayOf(d.date)}</b><span>${monthOf(d.date)}</span></div>
      <div class="lab"><b>${esc(d.label)}</b><br><span>${fmt(d.date)}</span></div>
      <div class="st-act">${action}</div>
    </div>`;
}

export function renderExam(id) {
  const c = byId(id);
  const b = BODIES[c.body];
  const dl = nextDeadline(c);
  const dleft = dl ? daysLeft(dl.date) : null;
  const maxV = (c.vacancy_history && c.vacancy_history.length) ? Math.max(...c.vacancy_history.map((v) => v.seats)) : 0;

  const countHtml = dl && dleft !== null && dleft >= 0
    ? `<div class="deadline-label">\u23F0 ${esc(dl.label)} &middot; ${fmt(dl.date)}</div>
       <div class="countbox" data-count-to="${dl.date}">
         <div class="count-unit"><b class="cu-d">${dleft}</b><span>Days</span></div>
         <div class="count-unit"><b class="cu-h">\u2013</b><span>Hours</span></div>
         <div class="count-unit"><b class="cu-m">\u2013</b><span>Mins</span></div>
       </div>`
    : `<div class="deadline-label">Key dates to be announced \u2014 follow to get notified.</div>`;

  const body = `<section class="page"><div class="wrap">
    <div class="crumb"><a href="/">Home</a> \u203A <a href="/body/${b.slug}/">${b.short}</a> \u203A <span>${esc(c.title)}</span></div>

    <div class="dash-hero">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;position:relative;z-index:2">
        <div>
          <div class="body-tag">${esc(b.name)}</div>
          <h1>${esc(c.title)}</h1>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">${pill(c.status)}<span class="tag" style="background:rgba(255,255,255,.12);color:#dbe6fe;border-color:rgba(255,255,255,.2)">${esc(c.qualification)}</span><span class="tag" style="background:rgba(255,255,255,.12);color:#dbe6fe;border-color:rgba(255,255,255,.2)">${inr(c.vacancy)} posts</span></div>
        </div>
        <div style="display:flex;gap:9px;flex-wrap:wrap">
          <a class="btn ghost" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff" href="${esc(officialLink(c, b, "apply"))}" target="_blank" rel="noopener">Apply \u2197</a>
          <button class="btn saf" data-follow="${c.id}" data-follow-btn aria-pressed="false">\u2606 Follow this exam</button>
        </div>
      </div>
      ${countHtml}
    </div>

    <nav class="dash-tabs" role="tablist" aria-label="Exam sections">
      <button class="dt on" role="tab" aria-selected="true" data-tab="overview">\ud83c\udfe0 Overview</button>
      ${patternPanel(c, b) ? `<button class="dt" role="tab" aria-selected="false" data-tab="pattern">\ud83d\udcdd Pattern &amp; Syllabus</button>` : ""}
      <button class="dt" role="tab" aria-selected="false" data-tab="cutoffs">\ud83d\udcca Cut-offs &amp; Results</button>
      ${applyPanel(c, b) ? `<button class="dt" role="tab" aria-selected="false" data-tab="apply">\ud83d\ude80 How to Apply</button>` : ""}
    </nav>

    <div class="tabpanel" data-panel="overview" role="tabpanel">
    <div class="dash-grid">
      <div>
        <div class="panel">
          <h3><span class="n">1</span> Timeline</h3>
          <div class="timeline">
            ${c.stages.map((s, i) => {
              const isNow = !s.done && (i === 0 || c.stages[i - 1].done);
              return `<div class="tl-node ${s.done ? "done" : ""} ${isNow ? "now" : ""}"><span class="dot"></span><b>${esc(s.name)}</b><span>${s.date ? fmtShort(s.date) : "TBA"}</span></div>`;
            }).join("")}
          </div>
        </div>

        <div class="panel">
          <h3><span class="n">2</span> Important dates</h3>
          ${c.dates.map((d) => stageRow(d, c, b)).join("")}
          <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)">
            <div class="small muted" style="margin-bottom:6px">Selection process</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">${c.selection.map((x, i) => `<span class="tag">${i + 1}. ${esc(x)}</span>`).join("")}</div>
          </div>
        </div>

        <div class="panel">
          <h3><span class="n">3</span> Vacancy trend <span class="small muted" style="font-weight:600;margin-left:auto">last ${c.vacancy_history.length} years</span></h3>
          <div class="bars">
            ${c.vacancy_history.map((v, i) => `<div class="b"><div class="bar ${i === c.vacancy_history.length - 1 ? "hl" : ""}" style="height:${Math.max(8, Math.round((v.seats / maxV) * 100))}%"><span>${v.seats >= 1000 ? (v.seats / 1000).toFixed(v.seats % 1000 ? 1 : 0) + "k" : v.seats}</span></div><em>${v.year}</em></div>`).join("")}
          </div>
        </div>

        <div class="panel linkcard">
          <h3>📊 Cut-offs, 📝 pattern &amp; 🚀 apply</h3>
          <p class="small muted" style="margin:4px 0 10px">Deep-dive tabs above: exam pattern with timing &amp; marking, full syllabus, year-wise cut-offs and results, fees and how to apply.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn ghost sm" data-goto-tab="cutoffs">Year-wise cut-offs →</button>
            ${patternPanel(c, b) ? `<button class="btn ghost sm" data-goto-tab="pattern">Exam pattern →</button>` : ""}
            ${applyPanel(c, b) ? `<button class="btn ghost sm" data-goto-tab="apply">How to apply →</button>` : ""}
          </div>
        </div>
      </div>

      <div>
        <div class="panel elig" data-age-min="${c.age_min}" data-age-max="${c.age_max}" data-qcode="${c.qualification_code}" data-exam="${esc(c.exam)}" data-qual="${esc(c.qualification)}">
          <h3>\u{1F3AF} Am I eligible?</h3>
          <p class="small muted" style="margin:2px 0 0">Check instantly for ${esc(c.exam)}.</p>
          <div class="inrow">
            <div><label for="eAge">Your age</label><input type="number" id="eAge" placeholder="21"></div>
            <div><label for="eQual">Qualification</label>
              <select id="eQual">
                <option value="10th">10th pass</option>
                <option value="12th">12th pass</option>
                <option value="graduate">Graduate</option>
                <option value="pg">Post-graduate</option>
              </select>
            </div>
          </div>
          <button class="btn saf sm" id="eligCheck">Check eligibility</button>
          <div class="res" id="eligRes"></div>
          <div class="small muted" style="margin-top:8px">Needs: ${esc(c.qualification)} &middot; Age ${c.age_min}&ndash;${c.age_max} (relaxations apply)</div>
        </div>

        <div class="panel">
          <h3>\u{1F195} What's new</h3>
          <div class="feed">
            ${c.updates.map((u) => {
              const ic = FEED_ICON[u.kind] || FEED_ICON.info;
              return `<div class="it" style="cursor:default"><div class="ic" style="background:${ic[1]}">${ic[0]}</div><div><h4 style="font-weight:600;font-size:13.5px">${esc(u.text)}</h4><p>${esc(u.when)}</p></div></div>`;
            }).join("")}
          </div>
        </div>

        <div class="panel">
          <h3>\u{1F517} Official sources</h3>
          ${c.links.map((l) => `<a class="src" href="${esc(l.url)}" target="_blank" rel="noopener">
            <div class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></div>
            <div><b>${esc(l.label)}</b><br><span>${esc(l.kind)} &middot; verified</span></div><span class="go">Open \u2197</span></a>`).join("")}
        </div>

        <div class="panel">
          <h3>\u{1F500} Related exams</h3>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${c.related.map(byId).filter(Boolean).map((r) => `<a class="src" style="width:100%;text-align:left" href="/exam/${r.id}/"><span class="badge" style="width:34px;height:34px;background:${BODIES[r.body].color}1a;color:${BODIES[r.body].color}">${BODIES[r.body].short}</span><div><b>${esc(r.exam)}</b><br><span>${esc(r.qualification)} &middot; ${inr(r.vacancy)} posts</span></div><span class="go">View &rarr;</span></a>`).join("")}
          </div>
        </div>
      </div>
    </div>
    </div>

    ${patternPanel(c, b) ? `<div class="tabpanel" data-panel="pattern" role="tabpanel" hidden>${patternPanel(c, b)}</div>` : ""}
    <div class="tabpanel" data-panel="cutoffs" role="tabpanel" hidden>${cutoffsPanel(c, b)}</div>
    ${applyPanel(c, b) ? `<div class="tabpanel" data-panel="apply" role="tabpanel" hidden>${applyPanel(c, b)}</div>` : ""}
    ${footer()}
  </div></section>`;

  return layout({
    title: `${c.title} \u2014 Dates, Vacancy, Eligibility & Apply | ExamPath`,
    description: `${c.title}: ${c.summary} ${inr(c.vacancy)} vacancies, age ${c.age_min}\u2013${c.age_max}, ${c.qualification}. Live countdown, timeline, cut-offs and official links.`,
    body,
    active: "/bodies",
    path: `/exam/${c.id}/`,
    breadcrumbs: [{ name: "Home", path: "/" }, { name: b.short, path: `/body/${b.slug}/` }, { name: c.title, path: `/exam/${c.id}/` }],
    jsonld: [jobPostingLD(c, b), faqLD(c)].filter(Boolean),
  });
}

function faqLD(c) {
  const faqs = Array.isArray(c.faqs) ? c.faqs.filter((f) => f && f.q && f.a) : [];
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function jobPostingLD(c, b) {
  const notif = c.stages.find((s) => /notif/i.test(s.name) && s.date) || c.stages.find((s) => s.date);
  const lastDeadline = [...c.dates].reverse().find((d) => d.is_deadline) || c.dates[c.dates.length - 1];
  const obj = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: c.title,
    description: c.summary + " Posts: " + c.posts,
    datePosted: notif ? notif.date : c.dates[0]?.date,
    validThrough: lastDeadline ? lastDeadline.date : undefined,
    employmentType: "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: b.name, sameAs: b.official_url },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressCountry: "IN", addressRegion: "India" },
    },
    totalJobOpenings: c.vacancy,
  };
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/* ---------- SEARCH ---------- */
export function renderSearch() {
  const cats = [["", "Any"], ["central", "Central"], ["state", "State"], ["banking", "Banking"], ["railways", "Railway"]];
  const body = `<section class="page"><div class="wrap">
    <div class="crumb"><a href="/">Home</a> \u203A <span>Search / Check Eligibility</span></div>
    <h1 class="page-title" style="margin-bottom:12px">Search exams &amp; check your eligibility</h1>
    <form class="searchbig" action="/search/" method="get" style="max-width:100%;box-shadow:var(--sh-s);border:1px solid var(--line)">
      <input id="pageSearch" name="q" placeholder="Search exams, eligibility, body\u2026" aria-label="Search exams">
      <button class="btn pri" type="submit">Search</button>
    </form>

    <!-- Eligibility filter panel (all optional; combines with the query; client-side) -->
    <div class="elig-panel" id="eligPanel">
      <div class="ef">
        <label for="fEdu">\uD83C\uDF93 Your education</label>
        <select id="fEdu">
          <option value="">Any</option>
          <option value="10th">10th pass</option>
          <option value="12th">12th pass</option>
          <option value="graduate">Graduate</option>
          <option value="pg">Post-graduate</option>
        </select>
      </div>
      <div class="ef">
        <label for="fAge">\uD83C\uDF82 Your age</label>
        <input type="number" id="fAge" min="14" max="60" placeholder="e.g. 21">
      </div>
      <div class="ef">
        <label for="fBody">\uD83C\uDFDB Conducted by</label>
        <select id="fBody">
          ${cats.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}
          <optgroup label="Specific body">
            ${DATA.bodies.map((b) => `<option value="body:${b.slug}">${esc(b.short)}</option>`).join("")}
          </optgroup>
        </select>
      </div>
      <button class="btn saf" id="fApply" type="button">Show my exams</button>
      <button class="btn ghost sm" id="fClear" type="button">Clear</button>
    </div>
    <div class="active-chips" id="activeChips"></div>

    <div class="filters" id="filterChips" style="margin-top:8px">
      ${["graduate","12th","banking","closing soon","ssc","upsc"].map((f) => `<a class="fchip" href="/search/?q=${encodeURIComponent(f)}">${f}</a>`).join("")}
    </div>
    <div id="parseNote"></div>
    <div class="sec-title"><h2 id="resultCount">${CYCLES.length} exams</h2></div>
    <div class="exam-grid" id="results">${CYCLES.map(examCard).join("")}</div>
    ${footer()}
  </div></section>`;
  return layout({
    title: "Search Government Exams & Check Eligibility \u2014 by education, age, body | ExamPath",
    description:
      "Search Indian government exams by free text or filters: qualification (graduate, 12th, 10th), age, conducting body (SSC, UPSC, IBPS) or closing soon.",
    body,
    active: "/search",
    path: "/search/",
    breadcrumbs: [{ name: "Home", path: "/" }, { name: "Search", path: "/search/" }],
    embedData: true,
  });
}

/* ---------- CALENDAR ---------- */
export function renderCalendar() {
  const all = [];
  CYCLES.forEach((c) => c.dates.forEach((d) => { if (daysLeft(d.date) >= -3) all.push({ ...d, c }); }));
  all.sort((a, b) => new Date(a.date) - new Date(b.date));
  const body = `<section class="page"><div class="wrap">
    <div class="crumb"><a href="/">Home</a> \u203A <span>Calendar</span></div>
    <div class="sec-title"><h2>\u{1F4C5} Deadline calendar</h2><span class="small muted">${all.length} upcoming dates</span></div>
    <div class="card" style="padding:6px 18px">
      ${all.map((d) => {
        const dlft = daysLeft(d.date);
        const hot = d.is_deadline && dlft <= 7 && dlft >= 0;
        const rt = dlft < 0 ? "Passed" : dlft === 0 ? "Today" : `${dlft}d`;
        return `<a class="kd" href="/exam/${d.c.id}/" style="cursor:pointer">
          <div class="date" style="${hot ? "background:var(--red-soft);color:var(--red)" : ""}"><b>${dayOf(d.date)}</b><span>${monthOf(d.date)}</span></div>
          <div class="lab"><b>${esc(d.c.exam)} \u2014 ${esc(d.label)}</b><br><span>${esc(d.c.title)} &middot; ${fmt(d.date)}</span></div>
          <div class="rt" data-daysleft="${d.date}" data-deadline="${d.is_deadline ? 1 : 0}" style="color:${hot ? "var(--red)" : dlft < 0 ? "var(--muted)" : "var(--brand)"}">${rt}</div>
        </a>`;
      }).join("")}
    </div>
    ${footer()}
  </div></section>`;
  return layout({
    title: "Exam Calendar \u2014 Upcoming Government Exam Deadlines | ExamPath",
    description:
      "Every upcoming Indian government exam deadline in one calendar, sorted by date with live days-left counters. SSC, UPSC, IBPS, RRB and state PSCs.",
    body,
    active: "/calendar",
    path: "/calendar/",
    breadcrumbs: [{ name: "Home", path: "/" }, { name: "Calendar", path: "/calendar/" }],
  });
}

/* ---------- category list pages (clean slugs, no query params) ---------- */
function renderCategory({ slug, h1, title, description, filter, active = "/bodies", empty }) {
  const list = CYCLES.filter(filter);
  const body = `<section class="page"><div class="wrap">
    <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${esc(h1)}</span></nav>
    <div class="sec-title"><h1 class="page-title">${h1}</h1><span class="small muted">${list.length} exam${list.length !== 1 ? "s" : ""}</span></div>
    <div class="exam-grid">${list.length ? list.map(examCard).join("") : `<div class="card" style="padding:36px;text-align:center;grid-column:1/-1"><p class="muted">${esc(empty || "Nothing here right now — check back soon.")}</p></div>`}</div>
    ${footer()}
  </div></section>`;
  return layout({
    title, description, body, active, path: `/${slug}/`,
    breadcrumbs: [{ name: "Home", path: "/" }, { name: h1.replace(/^[^\w]+\s*/, ""), path: `/${slug}/` }],
  });
}
export const renderNotifications = () => renderCategory({
  slug: "notifications", h1: "\u{1F514} Latest notifications",
  title: "Latest Government Exam Notifications & Open Applications | ExamPath",
  description: "All Indian government exams with open or upcoming applications — SSC, UPSC, IBPS, RRB and state PSCs — with deadlines, vacancies and eligibility.",
  filter: (c) => ["application_open", "closing_soon", "upcoming"].includes(c.status),
  empty: "No open notifications right now.",
});
export const renderResults = () => renderCategory({
  slug: "results", h1: "\u{1F3C6} Results & score cards",
  title: "Government Exam Results & Score Cards | ExamPath",
  description: "Declared and awaited results for Indian government exams — SSC, UPSC, IBPS, RRB and state PSCs.",
  filter: (c) => ["result_out", "result_awaited"].includes(c.status),
  empty: "No results declared yet.",
});
export const renderAdmitCards = () => renderCategory({
  slug: "admit-cards", h1: "\u{1F3AB} Admit cards",
  title: "Government Exam Admit Cards & Hall Tickets | ExamPath",
  description: "Admit cards and hall tickets for upcoming Indian government exams — download links and exam dates.",
  filter: (c) => c.status === "admit_card",
  empty: "No admit cards out right now.",
});

/* ---------- static content pages ---------- */
function staticPage({ slug, h1, title, description, article, extraLD = null }) {
  const body = `<section class="page"><div class="wrap wrap-narrow">
    <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${esc(h1)}</span></nav>
    <article class="prose"><h1 class="page-title">${esc(h1)}</h1>${article}</article>
    ${footer()}
  </div></section>`;
  return layout({
    title, description, body, active: "", path: `/${slug}/`,
    breadcrumbs: [{ name: "Home", path: "/" }, { name: h1, path: `/${slug}/` }],
    jsonld: extraLD ? [extraLD] : [],
  });
}
export const renderAbout = () => staticPage({
  slug: "about", h1: "About ExamPath",
  title: "About ExamPath — Free Government Exam Tracker",
  description: "ExamPath is a free, student-first tracker for every Indian government exam: notifications, deadlines, vacancies, eligibility and results from official sources.",
  article: `
    <p>ExamPath brings <b>every Indian government exam</b> into one fast, clean place — notifications, deadlines, vacancies, eligibility and results. No ads, no clutter, no missed forms.</p>
    <h2>How it works</h2>
    <ol>
      <li><b>We watch official sources.</b> An automated pipeline checks conducting-body websites for changes.</li>
      <li><b>We verify.</b> Every exam passes a &gt;90% confidence gate before it is published.</li>
      <li><b>We publish.</b> The data is stored durably and the site rebuilds automatically — updated daily.</li>
    </ol>
    <h2>What you get</h2>
    <ul>
      <li>Live countdowns to every deadline and a full calendar.</li>
      <li>An instant eligibility checker on each exam.</li>
      <li>An AI assistant that answers “which exam fits me?”.</li>
      <li>Official source links on every page — always verify there.</li>
    </ul>
    <p><a class="btn pri" href="/notifications/">See open notifications</a></p>`,
});
export const renderContact = () => staticPage({
  slug: "contact", h1: "Contact",
  title: "Contact ExamPath",
  description: "Get in touch with ExamPath — corrections, suggestions and feedback.",
  article: `
    <p>Spotted an error or want an exam added? We'd love to hear from you.</p>
    <ul>
      <li><b>Email:</b> <a href="mailto:hello@exampath.app">hello@exampath.app</a></li>
      <li><b>Corrections:</b> tell us the exam and the official link, and we'll verify and fix it.</li>
    </ul>
    <p class="small muted">ExamPath is an independent information service and is not affiliated with any government body.</p>`,
});
export const renderDisclaimer = () => staticPage({
  slug: "disclaimer", h1: "Disclaimer & privacy",
  title: "Disclaimer & Privacy | ExamPath",
  description: "ExamPath disclaimer and privacy note. Information is compiled from official sources; always verify on the official website.",
  article: `
    <h2>Disclaimer</h2>
    <p>ExamPath is <b>not a government website</b> and is not affiliated with any conducting body. Information is compiled from publicly available official sources and provided for convenience. Dates and details can change — <b>always verify on the official website</b> linked on each exam page before applying.</p>
    <h2>Privacy</h2>
    <p>ExamPath is a static website. We do not run ads or trackers and do not collect personal information. Your “followed exams” are stored only in your own browser (localStorage) and never leave your device.</p>`,
});
export const renderFaq = () => {
  const faqs = [
    { q: "Is ExamPath free?", a: "Yes. ExamPath is completely free, with no ads and no sign-up required." },
    { q: "How current is the data?", a: "An automated pipeline checks official sources and rebuilds the site daily. Every exam passes a >90% confidence gate before publishing." },
    { q: "Is this an official government website?", a: "No. ExamPath is an independent tracker. Always verify details on the official website linked on each exam page." },
    { q: "How do I check if I'm eligible?", a: "Open any exam page and use the built-in eligibility checker — enter your age and qualification for an instant answer." },
    { q: "Which exams are covered?", a: "Central and state government exams including SSC, UPSC, IBPS, RRB and state PSCs, with more added over time." },
    { q: "Can I get deadline reminders?", a: "Tap “Follow this exam” to save it in your browser; the site highlights upcoming deadlines for your followed exams." },
  ];
  const article = `<p>Common questions about ExamPath, eligibility and how the data works.</p>
    <div class="faq">${faqs.map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>`;
  const ld = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return staticPage({
    slug: "faq", h1: "Frequently asked questions",
    title: "FAQ — ExamPath Government Exam Tracker",
    description: "Answers about ExamPath: is it free, how current is the data, eligibility, reminders and which exams are covered.",
    article, extraLD: ld,
  });
};

/* ---------- color util ---------- */
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, bl = (n & 255) + pct;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); bl = Math.max(0, Math.min(255, bl));
  return "#" + (0x1000000 + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

/* ---------- SEO files ---------- */
export function sitemapXml() {
  const urls = ["/", "/notifications/", "/admit-cards/", "/results/", "/bodies/",
    "/calendar/", "/search/", "/about/", "/faq/", "/contact/", "/disclaimer/"];
  DATA.bodies.forEach((b) => urls.push(`/body/${b.slug}/`));
  urls.push("/states/");
  STATES.forEach((s) => urls.push(`/state/${s.slug}/`));
  CYCLES.forEach((c) => {
    urls.push(`/exam/${c.id}/`);
    EXAM_SECTIONS.forEach(([seg]) => urls.push(`/exam/${c.id}/${seg}/`));
    (c.yearwise || []).forEach((y) => urls.push(`/exam/${c.id}/${y.year}/`));
  });
  const today = DATA.generated_at;
  const items = urls.map((u) =>
    `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}
export function robotsTxt() {
  return `# ExamPath — all content is public and crawlable.
User-agent: *
Allow: /

# AI crawlers welcome (public exam info).
User-agent: GPTBot
Allow: /
User-agent: PerplexityBot
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

/* RSS 2.0 feed of the latest exam updates — for readers, agents and automations. */
export function rssXml() {
  const items = [];
  for (const c of CYCLES) for (const u of c.updates)
    items.push({ c, u, rank: whenRank(u.when) });
  items.sort((a, b) => a.rank - b.rank);
  const entries = items.slice(0, 30).map(({ c, u }) => `    <item>
      <title>${esc(c.exam)}: ${esc(u.text)}</title>
      <link>${abs(`/exam/${c.id}/`)}</link>
      <guid isPermaLink="false">${esc(c.id)}-${esc(u.text).slice(0, 40)}</guid>
      <description>${esc(u.text)} (${esc(u.when)})</description>
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
    <title>ExamPath — latest government exam updates</title>
    <link>${abs("/")}</link>
    <description>Notifications, admit cards, results and deadlines for Indian government exams.</description>
    <language>en-in</language>
    <lastBuildDate>${DATA.generated_at}</lastBuildDate>
${entries}
</channel></rss>
`;
}

/* =====================================================================
   State landing pages — all 28 states + key UTs. States with tracked exams
   link their bodies/exams; the rest are indexed "coming soon" pages with a
   unique description (long-tail SEO: "<state> govt exams 2026").
   ===================================================================== */
export const STATES = [
  { slug: "andhra-pradesh", name: "Andhra Pradesh", psc: "APPSC" },
  { slug: "arunachal-pradesh", name: "Arunachal Pradesh", psc: "APPSC (AR)" },
  { slug: "assam", name: "Assam", psc: "APSC" },
  { slug: "bihar", name: "Bihar", psc: "BPSC", bodies: ["bpsc"] },
  { slug: "chhattisgarh", name: "Chhattisgarh", psc: "CGPSC" },
  { slug: "goa", name: "Goa", psc: "Goa PSC" },
  { slug: "gujarat", name: "Gujarat", psc: "GPSC" },
  { slug: "haryana", name: "Haryana", psc: "HPSC" },
  { slug: "himachal-pradesh", name: "Himachal Pradesh", psc: "HPPSC" },
  { slug: "jharkhand", name: "Jharkhand", psc: "JPSC" },
  { slug: "karnataka", name: "Karnataka", psc: "KPSC" },
  { slug: "kerala", name: "Kerala", psc: "Kerala PSC" },
  { slug: "madhya-pradesh", name: "Madhya Pradesh", psc: "MPPSC", bodies: ["mppsc"] },
  { slug: "maharashtra", name: "Maharashtra", psc: "MPSC" },
  { slug: "manipur", name: "Manipur", psc: "MPSC (Manipur)" },
  { slug: "meghalaya", name: "Meghalaya", psc: "MPSC (Meghalaya)" },
  { slug: "mizoram", name: "Mizoram", psc: "MPSC (Mizoram)" },
  { slug: "nagaland", name: "Nagaland", psc: "NPSC" },
  { slug: "odisha", name: "Odisha", psc: "OPSC" },
  { slug: "punjab", name: "Punjab", psc: "PPSC" },
  { slug: "rajasthan", name: "Rajasthan", psc: "RPSC", bodies: ["rpsc"] },
  { slug: "sikkim", name: "Sikkim", psc: "SPSC" },
  { slug: "tamil-nadu", name: "Tamil Nadu", psc: "TNPSC" },
  { slug: "telangana", name: "Telangana", psc: "TSPSC" },
  { slug: "tripura", name: "Tripura", psc: "TPSC" },
  { slug: "uttar-pradesh", name: "Uttar Pradesh", psc: "UPPSC", bodies: ["uppsc"] },
  { slug: "uttarakhand", name: "Uttarakhand", psc: "UKPSC" },
  { slug: "west-bengal", name: "West Bengal", psc: "WBPSC" },
  { slug: "delhi", name: "Delhi (NCT)", psc: "DSSSB", ut: true },
  { slug: "jammu-kashmir", name: "Jammu & Kashmir", psc: "JKPSC", ut: true },
];

export function renderState(st) {
  const bodies = (st.bodies || []).map((s) => BODIES[s]).filter(Boolean);
  const exams = CYCLES.filter((c) => (st.bodies || []).includes(c.body));
  const live = exams.length > 0;
  const body = `<section class="page"><div class="wrap">
    <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/states/">States</a> › <span>${esc(st.name)}</span></nav>
    <div class="sec-title"><h1 class="page-title">${esc(st.name)} Government Exams</h1>
      ${live ? `<span class="tag">${exams.length} tracked exam${exams.length !== 1 ? "s" : ""}</span>` : `<span class="pill p-up"><span class="dot"></span>Coming soon</span>`}</div>
    <p class="muted" style="max-width:70ch;margin:0 0 18px">${live
      ? `Live ${st.name} state government exams conducted by ${bodies.map((b) => b.name).join(", ")} — notifications, deadlines, eligibility, cut-offs and results, verified from official sources.`
      : `We're expanding coverage of ${st.name} government exams (${st.psc} and other state recruitment boards — police, teachers and subordinate services). Exam tracking for ${st.name} is coming soon; meanwhile, browse all-India exams below that ${st.name} candidates can apply for.`}</p>
    ${live ? `<div class="body-grid blk">${bodies.map(bodyCard).join("")}</div>
      <div class="exam-grid blk">${exams.map(examCard).join("")}</div>`
      : `<div class="sec-title"><h2>All-India exams open to ${esc(st.name)} candidates</h2></div>
      <div class="exam-grid blk">${CYCLES.filter((c) => ["ssc", "upsc", "ibps", "rrb", "sbi", "rbi"].includes(c.body)).slice(0, 6).map(examCard).join("")}</div>`}
    <div class="panel"><h3>Browse other states</h3>
      <div class="chips">${STATES.filter((s) => s.slug !== st.slug).map((s) => `<a class="c" href="/state/${s.slug}/">${esc(s.name)}</a>`).join("")}</div></div>
    ${footer()}
  </div></section>`;
  return layout({
    title: `${st.name} Government Exams 2026 — ${st.psc} Notifications & Dates | ExamPath`,
    description: live
      ? `${st.name} government exams: ${exams.map((c) => c.exam).slice(0, 4).join(", ")} — dates, vacancies, eligibility and results from official sources.`
      : `${st.name} government exam notifications (${st.psc}, police, teachers) — coverage coming soon. Track all-India exams open to ${st.name} candidates.`,
    body, active: "/bodies", path: `/state/${st.slug}/`,
    breadcrumbs: [{ name: "Home", path: "/" }, { name: "States", path: "/states/" }, { name: st.name, path: `/state/${st.slug}/` }],
  });
}

export function renderStatesIndex() {
  const card = (s) => {
    const n = CYCLES.filter((c) => (s.bodies || []).includes(c.body)).length;
    return `<a class="bcard ${n ? "" : "muted-card"}" href="/state/${s.slug}/">
      <b>${esc(s.name)}</b><span>${n ? `${n} exam${n !== 1 ? "s" : ""} · ${esc(s.psc)}` : `${esc(s.psc)} · coming soon`}</span></a>`;
  };
  const body = `<section class="page"><div class="wrap">
    <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> › <span>States</span></nav>
    <div class="sec-title"><h1 class="page-title">Government exams by state</h1><span class="small muted">${STATES.length} states &amp; UTs</span></div>
    <p class="muted" style="max-width:70ch;margin:0 0 18px">Pick your state to see its public service commission and other state recruitment exams. States without tracked exams yet are marked — coverage grows continuously.</p>
    <div class="body-grid">${STATES.map(card).join("")}</div>
    ${footer()}
  </div></section>`;
  return layout({
    title: "Government Exams by State — All 28 States & UTs | ExamPath",
    description: "Browse Indian government exams state by state: UP, Bihar, MP, Rajasthan and every other state PSC, police and teacher recruitment.",
    body, active: "/bodies", path: "/states/",
    breadcrumbs: [{ name: "Home", path: "/" }, { name: "States", path: "/states/" }],
  });
}

/* =====================================================================
   Page-generation engine — per-exam section pages + per-year pages.
   Each is a distinct, SEO-optimised page that reuses the dashboard panels
   and cross-links the others (strong internal linking).
   ===================================================================== */
const EXAM_SECTIONS = [
  ["syllabus", "Syllabus & Exam Pattern"],
  ["eligibility", "Eligibility"],
  ["cut-offs", "Cut-offs & Results"],
  ["salary", "Salary & Fees"],
  ["how-to-apply", "How to Apply"],
  ["previous-papers", "Previous Papers"],
  ["faq", "FAQs"],
];

function sectionNav(c, active) {
  const item = (seg, label) =>
    `<a href="/exam/${c.id}/${seg ? seg + "/" : ""}" class="subnav-a ${active === seg ? "on" : ""}">${label}</a>`;
  return `<nav class="subnav" aria-label="Exam sections">
    ${item("", "\u{1F3E0} Overview")}
    ${EXAM_SECTIONS.map(([seg, label]) => item(seg, label)).join("")}
  </nav>`;
}

function subPage(c, b, { seg, h1, title, description, content, jsonld = [] }) {
  const body = `<section class="page"><div class="wrap">
    <nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/body/${b.slug}/">${esc(b.short)}</a> › <a href="/exam/${c.id}/">${esc(c.exam)}</a> › <span>${esc(h1)}</span></nav>
    <div class="sub-hero">
      ${emblem(b, 46)}
      <div><div class="body-tag" style="color:var(--muted)">${esc(b.name)}</div>
        <h1 class="page-title" style="font-size:24px">${esc(c.title)} — ${esc(h1)}</h1></div>
      <a class="btn pri sm" style="margin-left:auto" href="${esc(officialLink(c, b, "apply"))}" target="_blank" rel="noopener">Apply ↗</a>
    </div>
    ${sectionNav(c, seg)}
    ${content}
    <div class="panel" style="text-align:center"><a class="btn ghost" href="/exam/${c.id}/">← Full ${esc(c.exam)} dashboard</a></div>
    ${footer()}
  </div></section>`;
  return layout({
    title, description, body, active: "/bodies", path: `/exam/${c.id}/${seg}/`,
    breadcrumbs: [{ name: "Home", path: "/" }, { name: b.short, path: `/body/${b.slug}/` },
      { name: c.exam, path: `/exam/${c.id}/` }, { name: h1, path: `/exam/${c.id}/${seg}/` }],
    jsonld,
  });
}

function eligPanel(c, b) {
  return `<div class="panel elig" data-age-min="${c.age_min}" data-age-max="${c.age_max}" data-qcode="${c.qualification_code}" data-exam="${esc(c.exam)}" data-qual="${esc(c.qualification)}">
      <h3>\u{1F3AF} Am I eligible for ${esc(c.exam)}?</h3>
      <div class="kv"><div><span>Qualification</span><b>${esc(c.qualification)}</b></div>
        <div><span>Age limit</span><b>${c.age_min}–${c.age_max} years</b></div>
        <div><span>Vacancies</span><b>${inr(c.vacancy)}</b></div></div>
      <div class="inrow">
        <div><label for="eAge">Your age</label><input type="number" id="eAge" placeholder="21"></div>
        <div><label for="eQual">Qualification</label>
          <select id="eQual"><option value="10th">10th pass</option><option value="12th">12th pass</option><option value="graduate">Graduate</option><option value="pg">Post-graduate</option></select></div>
      </div>
      <button class="btn saf sm" id="eligCheck">Check eligibility</button>
      <div class="res" id="eligRes"></div>
      <p class="small muted" style="margin-top:8px">Age relaxations apply for reserved categories — confirm on the official notification.</p>
    </div>`;
}

function salaryFeesPanel(c, b) {
  const has = (x) => Array.isArray(x) && x.length;
  if (!has(c.salary) && !has(c.fees)) {
    return `<div class="panel"><p class="muted">Salary and fee details will appear once published. ${""}</p>${officialNote(b, officialLink(c, b, "notification"))}</div>`;
  }
  return `${has(c.salary) ? `<div class="panel"><h3>💰 Salary by post</h3>
      <div class="tbl-scroll"><table class="dtable"><tbody><tr><th>Post</th><th>Pay level</th><th>Pay scale</th><th>In-hand*</th></tr>
      ${c.salary.map((s) => `<tr><td><b>${esc(s.post)}</b></td><td>${esc(s.pay_level || "—")}</td><td>${s.pay_min ? "₹" + inr(s.pay_min) + "–₹" + inr(s.pay_max) : "—"}</td><td>${s.in_hand_approx ? "≈ ₹" + inr(s.in_hand_approx) : "—"}</td></tr>`).join("")}
      </tbody></table></div><p class="small muted" style="margin:8px 0 0">*Approximate; varies by city &amp; allowances.</p></div>` : ""}
    ${has(c.fees) ? `<div class="panel"><h3>💳 Application fee</h3>
      <div class="tbl-scroll"><table class="dtable"><tbody><tr><th>Category</th><th>Fee</th><th>Notes</th></tr>
      ${c.fees.map((f) => `<tr><td><b>${esc(f.category)}</b></td><td>${f.amount ? "₹" + inr(f.amount) : "Free"}</td><td class="small muted">${esc(f.notes || "")}</td></tr>`).join("")}
      </tbody></table></div></div>` : ""}
    ${officialNote(b, officialLink(c, b, "notification"))}`;
}

function howToPanel(c, b) {
  const has = (x) => Array.isArray(x) && x.length;
  return `${has(c.how_to_apply) ? `<div class="panel"><h3>🚀 How to apply for ${esc(c.exam)}</h3>
      <ol class="steps">${c.how_to_apply.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <a class="btn saf" style="margin-top:10px" href="${esc(officialLink(c, b, "apply"))}" target="_blank" rel="noopener">Apply on the official site ↗</a></div>`
    : `<div class="panel"><h3>🚀 How to apply</h3><p class="muted">Apply online on the official portal when the window opens.</p>
      <a class="btn saf" href="${esc(officialLink(c, b, "apply"))}" target="_blank" rel="noopener">Official apply portal ↗</a></div>`}
    ${(c.links || []).length ? `<div class="panel"><h3>🔗 Official sources</h3>${c.links.map(srcRow).join("")}</div>` : ""}`;
}

function prevPapersPanel(c, b) {
  const years = (c.yearwise || []).map((y) => y.year).sort((a, z) => z - a);
  return `<div class="panel">
      <h3>📄 Previous-year papers &amp; resources</h3>
      <p class="muted" style="margin:0 0 10px">Official previous-year question papers and answer keys for ${esc(c.exam)} are published free on the conducting body's website. Use the official links below — we don't host copyrighted papers.</p>
      ${(c.links || []).map(srcRow).join("")}
      <a class="src" href="${esc(b.official_url)}" target="_blank" rel="noopener"><div class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></div><div><b>${esc(b.short)} — official website</b><br><span>Question papers, keys &amp; results</span></div><span class="go">Open ↗</span></a>
    </div>
    ${years.length ? `<div class="panel"><h3>🗓 Year-wise pages</h3><div class="chips">${years.map((y) => `<a class="c" href="/exam/${c.id}/${y}/">${y} details</a>`).join("")}</div></div>` : ""}`;
}

function faqPanel(c, b) {
  const faqs = Array.isArray(c.faqs) ? c.faqs.filter((f) => f && f.q && f.a) : [];
  if (!faqs.length) return `<div class="panel"><p class="muted">FAQs will be added soon.</p>${officialNote(b, b.official_url)}</div>`;
  const ld = { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return { html: `<div class="panel"><h3>❓ ${esc(c.exam)} FAQs</h3><div class="faq">${faqs.map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div></div>${officialNote(b, b.official_url)}`, ld };
}

function examSectionRoutes(c) {
  const b = BODIES[c.body];
  const out = [];
  const P = (seg, h1, title, description, content, jsonld = []) =>
    out.push({ path: `exam/${c.id}/${seg}/index.html`, html: subPage(c, b, { seg, h1, title, description, content, jsonld }) });

  P("syllabus", "Syllabus & Exam Pattern",
    `${c.exam} Syllabus & Exam Pattern 2026 | ExamPath`,
    `${c.title} syllabus and exam pattern — sections, marks, duration and negative marking, subject-wise topics.`,
    patternPanel(c, b) || `<div class="panel"><p class="muted">Detailed syllabus & pattern will be published soon.</p>${officialNote(b, officialLink(c, b, "notification"))}</div>`);

  P("eligibility", "Eligibility",
    `${c.exam} Eligibility 2026 — Age, Qualification | ExamPath`,
    `${c.title} eligibility: qualification ${c.qualification}, age ${c.age_min}–${c.age_max}. Check instantly with the built-in checker.`,
    eligPanel(c, b), embedDataLD());

  P("cut-offs", "Cut-offs & Results",
    `${c.exam} Cut-off & Result 2026 (5-year) | ExamPath`,
    `${c.title} year-wise cut-offs, vacancies and result status for the last 5 years, with official links.`,
    cutoffsPanel(c, b));

  P("salary", "Salary & Fees",
    `${c.exam} Salary, Pay Scale & Application Fee | ExamPath`,
    `${c.title} salary by post, pay level and in-hand estimate, plus category-wise application fees.`,
    salaryFeesPanel(c, b));

  P("how-to-apply", "How to Apply",
    `How to Apply for ${c.exam} 2026 — Steps | ExamPath`,
    `Step-by-step guide to apply for ${c.title} on the official portal, with fee details and the apply link.`,
    howToPanel(c, b));

  P("previous-papers", "Previous Papers",
    `${c.exam} Previous-Year Papers (Official) | ExamPath`,
    `Official previous-year question papers, answer keys and results for ${c.title} — direct links to the conducting body.`,
    prevPapersPanel(c, b));

  const fp = faqPanel(c, b);
  P("faq", "FAQs", `${c.exam} FAQs — Common Questions | ExamPath`,
    `Frequently asked questions about ${c.title}: eligibility, pattern, fees, dates and more.`,
    fp.html || fp, fp.ld ? [fp.ld] : []);

  // per-year pages
  (c.yearwise || []).forEach((y) => {
    const stLabel = y.result_status === "declared" ? "Result declared" : y.result_status === "awaited" ? "Result awaited" : "Upcoming";
    const content = `<div class="panel"><h3>🗓 ${esc(c.exam)} ${y.year}</h3>
        <div class="kv"><div><span>Vacancies</span><b>${y.vacancy != null ? inr(y.vacancy) : "—"}</b></div>
        <div><span>UR cut-off</span><b>${y.cutoff_ur != null ? y.cutoff_ur : "—"}</b></div>
        <div><span>Result</span><b>${stLabel}</b></div></div>
        <a class="btn pri sm" style="margin-top:12px" href="${esc(y.result_url || b.official_url)}" target="_blank" rel="noopener">Check ${y.year} result on official site ↗</a>
      </div>
      <div class="panel"><h3>Other years</h3><div class="chips">${(c.yearwise || []).map((z) => `<a class="c" href="/exam/${c.id}/${z.year}/">${z.year}</a>`).join("")}</div></div>`;
    out.push({ path: `exam/${c.id}/${y.year}/index.html`,
      html: subPage(c, b, { seg: String(y.year), h1: `${y.year} — Vacancy, Cut-off & Result`,
        title: `${c.exam} ${y.year} — Vacancy, Cut-off & Result | ExamPath`,
        description: `${c.title} ${y.year}: vacancies, UR cut-off and result status with the official link.`,
        content }) });
  });
  return out;
}
function embedDataLD() { return []; }

export function allRoutes() {
  const routes = [
    { path: "index.html", html: renderHome() },
    { path: "notifications/index.html", html: renderNotifications() },
    { path: "admit-cards/index.html", html: renderAdmitCards() },
    { path: "results/index.html", html: renderResults() },
    { path: "bodies/index.html", html: renderBodies() },
    { path: "calendar/index.html", html: renderCalendar() },
    { path: "search/index.html", html: renderSearch() },
    { path: "about/index.html", html: renderAbout() },
    { path: "faq/index.html", html: renderFaq() },
    { path: "contact/index.html", html: renderContact() },
    { path: "disclaimer/index.html", html: renderDisclaimer() },
  ];
  DATA.bodies.forEach((b) => routes.push({ path: `body/${b.slug}/index.html`, html: renderBody(b.slug) }));
  routes.push({ path: "states/index.html", html: renderStatesIndex() });
  STATES.forEach((s) => routes.push({ path: `state/${s.slug}/index.html`, html: renderState(s) }));
  CYCLES.forEach((c) => {
    routes.push({ path: `exam/${c.id}/index.html`, html: renderExam(c.id) });
    for (const r of examSectionRoutes(c)) routes.push(r);
  });
  return routes;
}
