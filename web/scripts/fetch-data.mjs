// Optional build-time data source: pull the latest published snapshot from
// Supabase into web/data/exams.json so the static build reflects the newest
// pipeline run. No-op that keeps the committed dataset when Supabase isn't
// configured or is unreachable — this step never fails the build.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "exams.json");

if (!url || !key) {
  console.log("[fetch-data] Supabase not configured — using committed dataset.");
  process.exit(0);
}

try {
  const endpoint =
    `${url}/rest/v1/dataset_snapshots?select=payload&order=created_at.desc&limit=1`;
  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  const payload = Array.isArray(rows) && rows[0] && rows[0].payload;
  if (payload && Array.isArray(payload.bodies) && Array.isArray(payload.cycles)) {
    writeFileSync(OUT, JSON.stringify(payload, null, 2));
    console.log(
      `[fetch-data] wrote latest Supabase snapshot ` +
      `(${payload.bodies.length} bodies, ${payload.cycles.length} cycles) -> web/data/exams.json`
    );
  } else {
    console.log("[fetch-data] no snapshot rows yet — using committed dataset.");
  }
} catch (e) {
  console.log(`[fetch-data] skip (${e.message}) — using committed dataset.`);
}
process.exit(0);
