import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await readSession(req.cookies.get("ms_session")?.value);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const { cycle_id } = await req.json().catch(() => ({}));
  if (!cycle_id || !supabaseAdmin) return NextResponse.json({ ok: false }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from("follows").select("id")
    .eq("user_id", userId).eq("cycle_id", cycle_id).maybeSingle();
  if (existing) {
    await supabaseAdmin.from("follows").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, following: false });
  }
  const { error } = await supabaseAdmin.from("follows").insert({ user_id: userId, cycle_id });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, following: true });
}
