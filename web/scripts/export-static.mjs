// Builds the static site into web/out/ using the zero-dependency renderer.
// Wired to `npm run build` so a deployable export exists without a package
// registry. In an environment with registry access, `npm run build:next`
// (next build) produces the equivalent export from the App Router source.
import { mkdirSync, writeFileSync, rmSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { allRoutes, sitemapXml, robotsTxt, CSS } from "./site.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "out");

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
for (const r of routes) write(r.path, r.html);

// assets
write("assets/styles.css", CSS);
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

// SEO
write("sitemap.xml", sitemapXml());
write("robots.txt", robotsTxt());

// A simple 404 (static hosts serve this on unknown paths)
write("404.html", routes[0].html.replace(/<main id="app">[\s\S]*<\/main>/,
  '<main id="app"><section class="page"><div class="wrap"><div class="crumb"><a href="/">Home</a> › <span>Not found</span></div><div class="card" style="padding:48px;text-align:center"><div style="font-size:40px">\u{1F50D}</div><h2 style="margin:10px 0">Page not found</h2><p class="muted">That exam or page doesn’t exist. Try the <a href="/" style="color:var(--brand);font-weight:700">home page</a> or <a href="/search/" style="color:var(--brand);font-weight:700">search</a>.</p></div></div></section></main>'));

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
