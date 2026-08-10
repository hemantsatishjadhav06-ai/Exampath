// Builds the static site into web/out/ using the zero-dependency renderer.
// Wired to `npm run build` so a deployable export exists without a package
// registry. In an environment with registry access, `npm run build:next`
// (next build) produces the equivalent export from the App Router source.
import { mkdirSync, writeFileSync, rmSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { allRoutes, sitemapXml, robotsTxt, rssXml, CSS, DATA } from "./site.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "out");

// Optional base path for hosting under a sub-directory (e.g. GitHub Pages
// project sites served at /<repo>/). Empty => served at the domain root
// (local dev, Docker/Railway/Render static), so absolute links stay as-is.
const RAW_BASE = process.env.BASE_PATH || "";
const BASE = RAW_BASE ? "/" + RAW_BASE.replace(/^\/+|\/+$/g, "") : "";

// Optional minification (enabled in CI via MINIFY=1). Conservative: it removes
// comments and indentation/newlines but never collapses meaningful inline
// whitespace, so text and links keep their spacing. JS files are left intact
// (hosts serve them gzipped/brotli anyway).
const MINIFY = ["1", "true", "yes", "on"].includes((process.env.MINIFY || "").toLowerCase());
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/\n\s*/g, "")
    .trim();
}
function minifyHtml(html) {
  return html
    .replace(/<!--(?!\[)[\s\S]*?-->/g, "")   // strip comments (keep IE conditionals)
    .replace(/\n\s*/g, " ")                    // drop indentation/newlines
    .replace(/[ \t]{2,}/g, " ");               // collapse runs of spaces
}
const finalizeHtml = (html) => (MINIFY ? minifyHtml(withBase(html)) : withBase(html));

// Rewrite root-absolute URLs in a rendered HTML document to sit under BASE,
// and expose BASE to the client script for its runtime navigation. Leaves
// protocol-absolute (https://) and protocol-relative (//host) URLs untouched.
function withBase(html) {
  if (!BASE) return html;
  html = html.replace(/\b(href|src|action)="\/(?!\/)/g, `$1="${BASE}/`);
  html = html.replace(
    /<\/head>/,
    `<script>window.__BASE__=${JSON.stringify(BASE)};</script>\n</head>`
  );
  return html;
}

// Branded 1200×630 social share card (self-contained SVG).
function ogSvg() {
  const exams = DATA.cycles.length;
  const bodies = DATA.bodies.length;
  const vac = DATA.cycles.reduce((s, c) => s + (c.vacancy || 0), 0);
  const vacStr = vac >= 100000 ? (vac / 100000).toFixed(1) + "L+" : vac.toLocaleString("en-IN") + "+";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Segoe UI, Arial, sans-serif">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#1d4ed8"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1050" cy="120" r="220" fill="#ffffff" opacity="0.06"/>
  <circle cx="150" cy="560" r="180" fill="#f97316" opacity="0.10"/>
  <g transform="translate(90,150)">
    <rect x="0" y="0" width="64" height="64" rx="16" fill="#f97316"/>
    <text x="32" y="45" font-size="38" font-weight="800" fill="#fff" text-anchor="middle">E</text>
    <text x="82" y="46" font-size="42" font-weight="800" fill="#fff">ExamPath</text>
  </g>
  <text x="90" y="320" font-size="72" font-weight="800" fill="#ffffff">Every government exam.</text>
  <text x="90" y="400" font-size="72" font-weight="800" fill="#93c5fd">Every date. One place.</text>
  <g fill="#dbeafe" font-size="30" font-weight="600">
    <text x="90" y="500">📋 ${exams} live exams</text>
    <text x="430" y="500">🏛️ ${bodies} bodies</text>
    <text x="700" y="500">🎯 ${vacStr} vacancies</text>
  </g>
  <text x="90" y="575" font-size="24" fill="#93c5fd">SSC · UPSC · IBPS · RRB · State PSCs — verified from official sources</text>
</svg>`;
}

function write(rel, content) {
  const full = join(OUT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
function copyDir(src, destRel) {
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    if (statSync(s).isDirectory()) copyDir(s, join(destRel, name));
    else {
      const full = join(OUT, destRel, name);
      mkdirSync(dirname(full), { recursive: true });
      copyFileSync(s, full);
    }
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const routes = allRoutes();
for (const r of routes) write(r.path, finalizeHtml(r.html));

// assets
write("assets/styles.css", MINIFY ? minifyCss(CSS) : CSS);
copyFileSync(join(ROOT, "public/client.js"), join(OUT, "assets/client.js"));

// copy any other files in public/ (favicons etc.) except client.js already handled
try {
  for (const name of readdirSync(join(ROOT, "public"))) {
    if (name === "client.js") continue;
    const s = join(ROOT, "public", name);
    if (statSync(s).isDirectory()) copyDir(s, name);
    else copyFileSync(s, join(OUT, name));
  }
} catch (e) {}

// SEO + feeds + public data API (for readers, AI agents and automations)
write("sitemap.xml", sitemapXml());
write("robots.txt", robotsTxt());
write("rss.xml", rssXml());
write("exams.json", JSON.stringify(DATA));            // stable public JSON endpoint
write("api/exams.json", JSON.stringify(DATA));

// ---- PWA: installable + offline ----
const u = (p) => `${BASE}${p}`;                        // base-aware absolute path
write("manifest.webmanifest", JSON.stringify({
  name: "ExamPath — Government Exam Tracker",
  short_name: "ExamPath",
  description: "Every Indian government exam, every date, one place.",
  start_url: u("/"),
  scope: u("/"),
  display: "standalone",
  background_color: "#f5f7fb",
  theme_color: "#1d4ed8",
  lang: "en-IN",
  categories: ["education", "productivity", "reference"],
  icons: [
    { src: u("/favicon.svg"), sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
  ],
}, null, 2));

// Service worker: cache-first for assets, network-first for pages, offline fallback.
const CACHE = `exampath-v${DATA.generated_at}`;
write("sw.js", `const CACHE=${JSON.stringify(CACHE)};
const CORE=[${JSON.stringify(u("/"))},${JSON.stringify(u("/assets/styles.css"))},${JSON.stringify(u("/assets/client.js"))},${JSON.stringify(u("/search/"))},${JSON.stringify(u("/404.html"))}];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET"||new URL(req.url).origin!==location.origin)return;
  if(req.mode==="navigate"){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));return r}).catch(()=>caches.match(req).then(r=>r||caches.match(${JSON.stringify(u("/404.html"))}))));
    return;
  }
  e.respondWith(caches.match(req).then(c=>c||fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(cc=>cc.put(req,cp));return r})));
});
`);

// Social share image (SVG, 1200×630).
write("og.svg", ogSvg());

// IndexNow verification key file (instant search-engine indexing). The daily
// workflow submits changed URLs to IndexNow when INDEXNOW_KEY is set.
if (process.env.INDEXNOW_KEY) write(`${process.env.INDEXNOW_KEY}.txt`, process.env.INDEXNOW_KEY);

// A simple 404 (static hosts serve this on unknown paths)
write("404.html", finalizeHtml(routes[0].html.replace(/<main id="app">[\s\S]*<\/main>/,
  '<main id="app"><section class="page"><div class="wrap"><div class="crumb"><a href="/">Home</a> › <span>Not found</span></div><div class="card" style="padding:48px;text-align:center"><div style="font-size:40px">\u{1F50D}</div><h2 style="margin:10px 0">Page not found</h2><p class="muted">That exam or page doesn’t exist. Try the <a href="/" style="color:var(--brand);font-weight:700">home page</a> or <a href="/search/" style="color:var(--brand);font-weight:700">search</a>.</p></div></div></section></main>')));

// Ensure GitHub Pages serves the artifact as-is (no Jekyll processing).
write(".nojekyll", "");

console.log(`✓ Exported ${routes.length} pages + assets + sitemap/robots to out/`);
console.log("Route list:");
console.log("  /");
console.log("  /bodies/");
console.log("  /calendar/");
console.log("  /search/");
for (const r of routes) {
  if (r.path.startsWith("body/") || r.path.startsWith("exam/")) {
    console.log("  /" + r.path.replace(/index\.html$/, ""));
  }
}
