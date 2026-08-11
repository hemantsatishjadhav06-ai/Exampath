import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const data = JSON.parse(readFileSync(resolve(root, "data/exams.json"), "utf8"));
const overrides = JSON.parse(readFileSync(resolve(root, "data/verified-overrides.json"), "utf8"));
const strict = process.argv.includes("--strict");

const problems = [];
const warnings = [];
const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const absoluteUrl = /^https:\/\//i;

function warn(cycle, message) { warnings.push(`${cycle.id}: ${message}`); }
function fail(cycle, message) { problems.push(`${cycle.id}: ${message}`); }

for (const cycle of data.cycles) {
  const override = overrides[cycle.id] || {};
  const effective = { ...cycle, ...override };

  if (!effective.verification) warn(cycle, "no source evidence record; facts must not be presented as verified");
  if (effective.verification?.status === "verified" && !effective.verification.source_url) fail(cycle, "verified record has no source URL");
  if (effective.verification?.source_url && !absoluteUrl.test(effective.verification.source_url)) fail(cycle, "source URL is not absolute HTTPS");

  for (const link of effective.links || []) {
    if (!absoluteUrl.test(link.url)) fail(cycle, `link is not HTTPS: ${link.label}`);
    if (/notification/i.test(link.label) && !/\.pdf(?:$|\?)/i.test(link.url) && link.verified === true) {
      fail(cycle, `a verified notification link should point to the notification document, not a homepage: ${link.url}`);
    }
  }

  for (const date of effective.dates || []) {
    if (!isoDay.test(date.date)) fail(cycle, `invalid date format: ${date.date}`);
    if (date.precision === "tentative") warn(cycle, `tentative date must not be shown as an exact exam day: ${date.label}`);
  }

  for (const stage of effective.stages || []) {
    if (stage.date && !isoDay.test(stage.date)) fail(cycle, `invalid stage date: ${stage.date}`);
    if (stage.precision === "tentative" && stage.date) warn(cycle, `tentative stage has a day value: ${stage.name}`);
  }

  for (const update of effective.updates || []) {
    if (!update.published_at && !/^\d+\s*[hdmw]$/i.test(update.when || "")) {
      warn(cycle, `update has no machine-readable publication date: ${update.text}`);
    }
  }
}

console.log(`ExamPath data audit: ${data.cycles.length} cycles`);
console.log(`Warnings: ${warnings.length}`);
for (const item of warnings) console.log(`  ⚠ ${item}`);
console.log(`Errors: ${problems.length}`);
for (const item of problems) console.log(`  ✗ ${item}`);

if (strict && problems.length) process.exit(1);
if (!strict) console.log("Non-strict audit completed. Use --strict in CI after all source gaps are resolved.");
