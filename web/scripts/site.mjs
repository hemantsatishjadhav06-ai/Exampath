// Zero-dependency static renderer for ExamPath.
// Reads data/exams.json + app/globals.css and emits every route as HTML.
// Mirrors the Next.js components in components/ and app/ so the exported
// site matches what `next build` would produce (same markup + class names).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const SITE_URL = "https://exampath.example";
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
      <span class="badge" style="background:${b.color}1a;color:${b.color}">${b.short}</span>
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
    <div class="ic" style="background:${b.color}">${b.short}</div>
    <b>${b.short}</b><span>${n} exam${n > 1 ? "s" : ""} &middot; ${esc(b.level)}</span>
  </a>`;
}

function footer() {
  return `<div class="foot"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center">
    <div><b>ExamPath</b> &mdash; every exam, every date, one place.</div>
    <div class="small">Data compiled from official sources. Always verify on the official website. Not a government website.</div>
  </div></div>`;
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

export function layout({ title, description, body, active = "/", jsonld = "", embedData = false }) {
  const navItem = (href, label, base) =>
    `<a href="${href}" class="${active === base ? "active" : ""}">${label}</a>`;
  const tabItem = (href, label, base, icon) =>
    `<a href="${href}" class="${active === base ? "active" : ""}">${icon}${label}</a>`;
  const dataScript = embedData
    ? `<script id="exampath-data" type="application/json">${JSON.stringify({
        bodies: BODIES,
        cycles: CYCLES,
        now: Date.now(),
      }).replace(/</g, "\\u003c")}</script>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="canonical" href="${SITE_URL}${active === "/" ? "/" : ""}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="/assets/styles.css">
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ""}
</head>
<body>
<header class="top">
  <div class="wrap bar">
    <a class="logo" href="/"><span class="glyph"> E</span><span><b>Exam</b><i>Path</i></span></a>
    <nav class="navlinks">
      ${navItem("/", "Home", "/")}
      ${navItem("/bodies/", "Exams", "/bodies")}
      ${navItem("/calendar/", "Calendar", "/calendar")}
      ${navItem("/search/", "Search", "/search")}
    </nav>
    <div class="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="topSearch" placeholder="Search exams, e.g. SSC, age 21, graduate\u2026" aria-label="Search exams">
    </div>
    <a class="btn-login" href="/search/">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
      Login
    </a>
  </div>
</header>

<main id="app">${body}</main>

<nav class="tabbar">
  ${tabItem("/", "Home", "/", ICONS.home)}
  ${tabItem("/bodies/", "Exams", "/bodies", ICONS.exams)}
  ${tabItem("/calendar/", "Calendar", "/calendar", ICONS.cal)}
  ${tabItem("/search/", "Search", "/search", ICONS.search)}
</nav>

<div id="toast" role="status" style="position:fixed;bottom:84px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;padding:11px 18px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--sh-l);z-index:80;opacity:0;transition:.25s;pointer-events:none;max-width:90vw;text-align:center"></div>
${dataScript}
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
    <div class="wrap">
      <span class="eyebrow">\u{1F1EE}\u{1F1F3} ${CYCLES.length} live exams &middot; ${Object.keys(BODIES).length} bodies &middot; updated daily</span>
      <h1>Every government exam. <span class="u">Every date.</span> One place.</h1>
      <p class="sub">Notifications, deadlines, vacancies, eligibility and results &mdash; compiled from official sources and always current. Never miss a form again.</p>
      <form class="searchbig" action="/search/" method="get">
        <input id="heroSearch" name="q" placeholder="Try \u201cSSC graduate\u201d, \u201cage 21\u201d, or \u201cbank exams\u201d\u2026" aria-label="Search exams">
        <button class="btn saf" type="submit">Search</button>
      </form>
      <div class="chips">
        <a class="c" href="/search/?q=graduate">\u{1F393} Graduate exams</a>
        <a class="c" href="/search/?q=12th">\u{1F4D7} 12th pass</a>
        <a class="c" href="/search/?q=banking">\u{1F3E6} Banking</a>
        <a class="c" href="/search/?q=closing%20soon">\u23F0 Closing soon</a>
      </div>
      <div class="hero-stats">
        <div class="s"><b>${inr(totalVac)}+</b><span>Total vacancies tracked</span></div>
        <div class="s"><b>${soon.length}</b><span>Deadlines this month</span></div>
        <div class="s"><b>100%</b><span>Official-source verified</span></div>
      </div>
    </div>
  </section>

  <div class="wrap pull">
    <div class="blk">
      <div class="sec-title"><h2 style="color:#fff">\u23F0 Closing soon</h2><a href="/calendar/" style="color:#dbe6fe">Full calendar &rarr;</a></div>
      <div class="dl-strip">
        ${soon.map(({ c, d }) => `
          <a class="dl-card" href="/exam/${c.id}/">
            <div class="cd" data-countdown="${d.date}">${daysLeft(d.date)}<small> days left</small></div>
            <h4>${esc(c.title)}</h4>
            <div class="small muted">${esc(d.label)} &middot; ${fmt(d.date)}</div>
          </a>`).join("")}
      </div>
    </div>

    <div class="blk">
      <div class="sec-title"><h2>Popular exams</h2><a href="/bodies/">Browse all &rarr;</a></div>
      <div class="exam-grid">${featured.map(examCard).join("")}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 340px;gap:20px" class="blk home-2col">
      <div>
        <div class="sec-title"><h2>Browse by body</h2></div>
        <div class="body-grid">${DATA.bodies.map(bodyCard).join("")}</div>
      </div>
      <div>
        <div class="sec-title"><h2>Latest updates</h2></div>
        <div class="card" style="padding:6px 16px">
          <div class="feed">
            ${latestUpdates(6).map((f) => feedItem(f.cycleId, f.title, f.text, f.kind, f.when)).join("")}
          </div>
        </div>
      </div>
    </div>
    ${footer()}
  </div>`;

  return layout({
    title: "ExamPath \u2014 Every government exam. Every date. One place.",
    description:
      "Track every Indian government exam (SSC, UPSC, IBPS, RRB, state PSCs) \u2014 notifications, deadlines, vacancies, eligibility and results, compiled from official sources.",
    body,
    active: "/",
  });
}

/* ---------- BODIES INDEX ---------- */
export function renderBodies() {
  const body = `<section class="page"><div class="wrap">
    <div class="crumb"><a href="/">Home</a> \u203A <span>All exams</span></div>
    <div class="sec-title"><h2>Browse by conducting body</h2></div>
    <div class="body-grid blk">${DATA.bodies.map(bodyCard).join("")}</div>
    <div class="sec-title"><h2>All tracked exams</h2></div>
    <div class="exam-grid">${CYCLES.map(examCard).join("")}</div>
    ${footer()}
  </div></section>`;
  return layout({
    title: "All Government Exams & Conducting Bodies | ExamPath",
    description:
      "Browse every tracked Indian government exam by conducting body \u2014 SSC, UPSC, IBPS, RRB and state PSCs \u2014 with live dates, vacancies and eligibility.",
    body,
    active: "/bodies",
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
      <p style="color:#e6eefc;margin:6px 0 0;max-width:560px">Tracking ${list.length} exam${list.length > 1 ? "s" : ""} &middot; ${inr(totalVac)} vacancies. Current openings, calendar and the latest official updates.</p>
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
  });
}

/* ---------- EXAM DASHBOARD ---------- */
export function renderExam(id) {
  const c = byId(id);
  const b = BODIES[c.body];
  const dl = nextDeadline(c);
  const dleft = daysLeft(dl.date);
  const maxV = Math.max(...c.vacancy_history.map((v) => v.seats));

  const countHtml = dleft >= 0
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
        <button class="btn saf" data-follow="${c.id}" data-follow-btn aria-pressed="false">\u2606 Follow this exam</button>
      </div>
      ${countHtml}
    </div>

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
          ${c.dates.map((d) => {
            const dlft = daysLeft(d.date);
            const color = d.is_deadline && dlft >= 0 && dlft <= 7 ? "var(--red)" : dlft < 0 ? "var(--muted)" : "var(--brand)";
            const rt = dlft < 0 ? "Done" : dlft === 0 ? "Today" : `${dlft} days`;
            return `<div class="kd">
              <div class="date"><b>${dayOf(d.date)}</b><span>${monthOf(d.date)}</span></div>
              <div class="lab"><b>${esc(d.label)}</b><br><span>${fmt(d.date)}</span></div>
              <div class="rt" data-daysleft="${d.date}" data-deadline="${d.is_deadline ? 1 : 0}" style="color:${color}">${rt}</div>
            </div>`;
          }).join("")}
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

        <div class="panel">
          <h3><span class="n">4</span> Previous cut-offs <span class="small muted" style="font-weight:600;margin-left:auto">out of 100</span></h3>
          <table class="dtable"><tbody><tr><th>Category</th><th>Cut-off</th><th></th></tr>
            ${c.cutoffs.map((o) => `<tr><td><b>${esc(o.category)}</b></td><td>${o.marks}</td><td style="width:55%"><div style="height:8px;border-radius:6px;background:var(--brand-soft)"><div style="height:8px;border-radius:6px;width:${Math.min(100, o.marks)}%;background:var(--brand)"></div></div></td></tr>`).join("")}
          </tbody></table>
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
    ${footer()}
  </div></section>`;

  return layout({
    title: `${c.title} \u2014 Dates, Vacancy, Eligibility & Apply | ExamPath`,
    description: `${c.title}: ${c.summary} ${inr(c.vacancy)} vacancies, age ${c.age_min}\u2013${c.age_max}, ${c.qualification}. Live countdown, timeline, cut-offs and official links.`,
    body,
    active: "/bodies",
    jsonld: jobPostingLD(c, b),
  });
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
  const body = `<section class="page"><div class="wrap">
    <div class="crumb"><a href="/">Home</a> \u203A <span>Search</span></div>
    <form class="searchbig" action="/search/" method="get" style="max-width:100%;box-shadow:var(--sh-s);border:1px solid var(--line)">
      <input id="pageSearch" name="q" placeholder="Search exams, eligibility, body\u2026" aria-label="Search exams">
      <button class="btn pri" type="submit">Search</button>
    </form>
    <div class="filters" id="filterChips" style="margin-top:16px">
      ${["graduate","12th","banking","closing soon","ssc","upsc"].map((f) => `<a class="fchip" href="/search/?q=${encodeURIComponent(f)}">${f}</a>`).join("")}
    </div>
    <div id="parseNote"></div>
    <div class="sec-title"><h2 id="resultCount">${CYCLES.length} exams</h2></div>
    <div class="exam-grid" id="results">${CYCLES.map(examCard).join("")}</div>
    ${footer()}
  </div></section>`;
  return layout({
    title: "Search Government Exams \u2014 by eligibility, body & deadline | ExamPath",
    description:
      "Search Indian government exams by free text or filters: qualification (graduate, 12th, 10th), age, conducting body (SSC, UPSC, IBPS) or closing soon.",
    body,
    active: "/search",
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
  });
}

/* ---------- color util ---------- */
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, bl = (n & 255) + pct;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); bl = Math.max(0, Math.min(255, bl));
  return "#" + (0x1000000 + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

/* ---------- SEO files ---------- */
export function sitemapXml() {
  const urls = ["/", "/bodies/", "/calendar/", "/search/"];
  DATA.bodies.forEach((b) => urls.push(`/body/${b.slug}/`));
  CYCLES.forEach((c) => urls.push(`/exam/${c.id}/`));
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
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

export function allRoutes() {
  const routes = [
    { path: "index.html", html: renderHome() },
    { path: "bodies/index.html", html: renderBodies() },
    { path: "search/index.html", html: renderSearch() },
    { path: "calendar/index.html", html: renderCalendar() },
  ];
  DATA.bodies.forEach((b) => routes.push({ path: `body/${b.slug}/index.html`, html: renderBody(b.slug) }));
  CYCLES.forEach((c) => routes.push({ path: `exam/${c.id}/index.html`, html: renderExam(c.id) }));
  return routes;
}
