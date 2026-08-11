// ExamPath end-to-end checks + screenshots.
// Uses the globally-installed Playwright core to drive the bundled Chromium.
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

function trackErrors(page, label) {
  const errs = [];
  page.on("pageerror", (e) => errs.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errs.push(`[${label}] console.error: ${m.text()}`); });
  return errs;
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT), "--directory", OUT], { stdio: "ignore" });
  const cleanup = () => { try { server.kill("SIGKILL"); } catch {} };

  try {
    const up = await waitForServer(BASE + "/");
    if (!up) throw new Error("static server did not start on " + BASE);
    const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

    console.log("\nTest 1 — Home page");
    {
      const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
      const page = await ctx.newPage();
      const errs = trackErrors(page, "home");
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      check("hero headline renders", /Every government exam/i.test((await page.textContent("h1")) || ""));
      check("exam cards exist", await page.locator(".xcard").count() > 0);
      check("home no unsupported 100% verification claim", !(await page.textContent("body")).includes("100%\nOfficial-source verified"));
      check("no console/page errors on home", errs.length === 0);
      await ctx.close();
    }

    console.log("\nTest 2 — Verified SSC CGL dashboard");
    {
      const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
      const page = await ctx.newPage();
      const errs = trackErrors(page, "exam");
      await page.goto(BASE + "/exam/ssc-cgl-2026/", { waitUntil: "networkidle" });
      check("dashboard shows exam title", /SSC CGL 2026/i.test((await page.textContent(".dash-hero h1")) || ""));
      check("source is marked verified", /Official-source verified/i.test((await page.textContent("body")) || ""));
      check("corrected tentative vacancy is shown", /12,256/.test((await page.textContent("body")) || ""));
      check("corrected original closing date is shown", /22 Jun 2026/i.test((await page.textContent("body")) || ""));
      check("reopened window is shown", /23 Jun 2026/i.test((await page.textContent("body")) || ""));
      check("no invented exact Tier-I date", !(await page.textContent("body")).includes("22 Sep 2026"));
      check("eligibility is framed as basic screening", /basic screening|basic eligibility/i.test((await page.textContent("body")) || ""));
      check("FAQ content exists", /Frequently asked questions/i.test((await page.textContent("body")) || ""));
      check("JSON-LD exists", await page.locator('script[type="application/ld+json"]').count() > 0);
      await page.fill("#eAge", "25");
      await page.selectOption("#eQual", "graduate");
      await page.click("#eligCheck");
      check("eligibility checker responds", /appear to match|Basic screen/i.test((await page.textContent("#eligRes")) || ""));
      check("no console/page errors on exam", errs.length === 0);
      await ctx.close();
    }

    console.log("\nTest 3 — Search & Calendar");
    {
      const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
      const page = await ctx.newPage();
      const errs = trackErrors(page, "search");
      await page.goto(BASE + "/search/?q=graduate", { waitUntil: "networkidle" });
      check("search renders filtered results", await page.locator("#results .xcard").count() > 0);
      check("search parses query into filters", /Understood/i.test((await page.textContent("#parseNote")) || ""));
      await page.goto(BASE + "/calendar/", { waitUntil: "networkidle" });
      check("calendar renders date rows", await page.locator(".kd").count() > 0);
      check("no errors on search/calendar", errs.length === 0);
      await ctx.close();
    }

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
      await page.screenshot({ path: join(SHOTS, s.name + ".png"), fullPage: true });
      console.log("  ✓ saved " + s.name + ".png");
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
