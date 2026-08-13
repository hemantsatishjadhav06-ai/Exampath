import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { issueSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { contact_type, contact_value, code } = await req.json().catch(() => ({}));
  if (!contact_type || !contact_value || !code || !supabaseAdmin) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { data: otp } = await supabaseAdmin.from("otp_codes").select("*")
    .eq("contact_type", contact_type).eq("contact_value", contact_value)
    .eq("code", code).is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!otp) return NextResponse.json({ ok: false }, { status: 401 });

  await supabaseAdmin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
  const { data: user, error } = await supabaseAdmin.from("app_users")
    .upsert({ contact_type, contact_value }, { onConflict: "contact_type,contact_value" })
    .select().single();
  if (error || !user) return NextResponse.json({ ok: false }, { status: 500 });

  const token = await issueSession(String(user.id));
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ms_session", token, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 90 * 86400, path: "/",
  });
  return res;
}
