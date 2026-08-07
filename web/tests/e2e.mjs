// ExamPath end-to-end checks + screenshots.
// Uses the globally-installed Playwright core to drive the bundled Chromium.
// Serves the static export (web/out/) with `python3 -m http.server 4321`.
// Fails on any console pageerror or failed assertion.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "out");
const SHOTS = join(ROOT, "test-screenshots");
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:4321";
const PORT = 4321;

mkdirSync(SHOTS, { recursive: true });

let passed = 0;
const failures = [];
function check(name, cond) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failures.push(name); console.log("  ✗ " + name); }
}

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

// Attach error listeners; returns an array that collects pageerrors.
function trackErrors(page, label) {
  const errs = [];
  page.on("pageerror", (e) => errs.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errs.push(`[${label}] console.error: ${m.text()}`); });
  return errs;
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT), "--directory", OUT], {
    stdio: "ignore",
  });
  const cleanup = () => { try { server.kill("SIGKILL"); } catch {} };

  try {
    const up = await waitForServer(BASE + "/");
    if (!up) throw new Error("static server did not start on " + BASE);

    const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

    /* ---- Test 1: HOME renders hero + exam cards ---- */
    console.log("\nTest 1 — Home page");
    {
      const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
      const page = await ctx.newPage();
      const errs = trackErrors(page, "home");
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      const heroText = await page.textContent("h1");
      check("hero headline renders", /Every government exam/i.test(heroText || ""));
      const cards = await page.locator(".xcard").count();
      check("exam cards exist (" + cards + ")", cards > 0);
      const strip = await page.locator(".dl-card").count();
      check("closing-soon strip renders (" + strip + ")", strip > 0);
      check("no console/page errors on home", errs.length === 0);
      if (errs.length) console.log("    " + errs.join("\n    "));
      await ctx.close();
    }

    /* ---- Test 2: EXAM dashboard shows title + timeline ---- */
    console.log("\nTest 2 — Exam dashboard (/exam/ssc-cgl-2026/)");
    {
      const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
      const page = await ctx.newPage();
      const errs = trackErrors(page, "exam");
      await page.goto(BASE + "/exam/ssc-cgl-2026/", { waitUntil: "networkidle" });
      const title = await page.textContent(".dash-hero h1");
      check("dashboard shows exam title", /SSC CGL 2026/i.test(title || ""));
      const timeline = await page.locator(".timeline .tl-node").count();
      check("timeline renders (" + timeline + " nodes)", timeline > 0);
      const countbox = await page.locator(".countbox").count();
      check("live countdown box present", countbox > 0);
      const jsonld = await page.locator('script[type="application/ld+json"]').count();
      check("JSON-LD JobPosting present", jsonld > 0);
      // exercise the eligibility checker
      await page.fill("#eAge", "25");
      await page.selectOption("#eQual", "graduate");
      await page.click("#eligCheck");
      const res = await page.textContent("#eligRes");
      check("eligibility checker responds", /eligible/i.test(res || ""));
      check("no console/page errors on exam", errs.length === 0);
      if (errs.length) console.log("    " + errs.join("\n    "));
      await ctx.close();
    }

    /* ---- Test 3: SEARCH + CALENDAR load with no pageerror ---- */
    console.log("\nTest 3 — Search & Calendar (no pageerror)");
    {
      const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
      const page = await ctx.newPage();
      const errs = trackErrors(page, "search");
      await page.goto(BASE + "/search/?q=graduate", { waitUntil: "networkidle" });
      const results = await page.locator("#results .xcard").count();
      check("search renders filtered results (" + results + ")", results > 0);
      const note = await page.textContent("#parseNote");
      check("search parses query into filters", /Understood/i.test(note || ""));
      check("no errors on search", errs.length === 0);
      if (errs.length) console.log("    " + errs.join("\n    "));

      const errs2 = trackErrors(page, "calendar");
      const before = errs2.length;
      await page.goto(BASE + "/calendar/", { waitUntil: "networkidle" });
      const rows = await page.locator(".kd").count();
      check("calendar renders date rows (" + rows + ")", rows > 0);
      check("no errors on calendar", errs2.length === before);
      if (errs2.length) console.log("    " + errs2.join("\n    "));
      await ctx.close();
    }

    /* ---- Test 4: screenshots (desktop + mobile) ---- */
    console.log("\nTest 4 — Screenshots");
    const shots = [
      { name: "home-desktop", url: "/", w: 1380, h: 900 },
      { name: "home-mobile", url: "/", w: 390, h: 844 },
      { name: "exam-desktop", url: "/exam/ssc-cgl-2026/", w: 1380, h: 900 },
      { name: "exam-mobile", url: "/exam/ssc-cgl-2026/", w: 390, h: 844 },
    ];
    for (const s of shots) {
      const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h } });
      const page = await ctx.newPage();
      await page.goto(BASE + s.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(250);
      const file = join(SHOTS, s.name + ".png");
      await page.screenshot({ path: file, fullPage: true });
      console.log("  ✓ saved " + file);
      passed++;
      await ctx.close();
    }

    await browser.close();
  } finally {
    cleanup();
  }

  console.log("\n" + "=".repeat(46));
  console.log(`RESULT: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("FAILURES:\n  - " + failures.join("\n  - "));
    process.exit(1);
  }
  console.log("ALL GREEN ✓");
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
