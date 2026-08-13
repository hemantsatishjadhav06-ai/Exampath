import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/** Supabase Database Webhook receiver (INSERT/UPDATE on content tables).
 *  Configure the webhook to send header `x-revalidate-secret: $REVALIDATE_SECRET`. */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let payload: any;
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const table: string = payload?.table ?? "";
  const row = payload?.record ?? payload?.old_record ?? {};
  const paths = new Set<string>(["/", "/hi"]);

  const addCycle = (id?: string) => {
    if (!id) return;
    for (const seg of ["", "/apply", "/syllabus", "/exam-pattern", "/cutoff", "/admit-card", "/result"]) {
      paths.add(`/exam/${id}${seg}`); paths.add(`/hi/exam/${id}${seg}`);
    }
  };
  const addBody = (slug?: string) => {
    if (!slug) return;
    paths.add(`/body/${slug}`); paths.add(`/hi/body/${slug}`);
    paths.add("/bodies"); paths.add("/hi/bodies");
  };

  switch (table) {
    case "exam_cycles": addCycle(row.id); addBody(row.body_slug); break;
    case "updates": case "key_dates": case "stages": case "cutoffs": case "cycle_links":
      addCycle(row.cycle_id); paths.add("/calendar"); paths.add("/hi/calendar"); break;
    case "bodies": addBody(row.slug); break;
    case "exams": {
      addBody(row.body_slug);
      break;
    }
    default: break;
  }
  for (const p of paths) revalidatePath(p);
  return NextResponse.json({ ok: true, revalidated: [...paths] });
}
