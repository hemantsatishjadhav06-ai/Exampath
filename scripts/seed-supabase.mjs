// Load db/seed.json into Supabase (run once after db/schema.sql):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-supabase.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(url, key);
const seed = JSON.parse(readFileSync(new URL("../db/seed.json", import.meta.url), "utf8"));

// Insert in FK order; identity columns are stripped so Postgres assigns them.
const PLAN = [
  ["states", "slug", null], ["categories", "slug", null], ["bodies", "slug", null],
  ["exams", "slug", null], ["exam_cycles", "id", null],
  ["stages", null, "id"], ["key_dates", null, "id"], ["cutoffs", null, "id"],
  ["cycle_links", null, "id"], ["updates", null, "id"], ["vacancy_history", null, "id"],
];
for (const [table, conflict, strip] of PLAN) {
  let rows = seed[table] ?? [];
  if (strip) rows = rows.map(({ [strip]: _omit, ...rest }) => rest);
  const res = conflict
    ? await sb.from(table).upsert(rows, { onConflict: conflict })
    : await sb.from(table).insert(rows);
  console.log(table.padEnd(16), res.error ? `ERROR: ${res.error.message}` : `ok (${rows.length})`);
  if (res.error) process.exit(1);
}
console.log("Seed loaded. Unset DATA_MODE=seed on the web service to switch to Supabase.");
