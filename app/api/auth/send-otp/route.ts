import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Provider abstraction — wire WhatsApp Business / Telegram Bot / SMS gateway
 *  here once credentials exist. Until then we store the code but return 503
 *  only if NO provider is configured, so the flow is testable end-to-end. */
async function sendOtp(contactType: string, contactValue: string, code: string): Promise<boolean> {
  if (contactType === "telegram" && process.env.TELEGRAM_BOT_TOKEN) {
    // Telegram delivery requires a chat_id mapping (user must /start the bot);
    // handled by the n8n side in production. Treat as accepted here.
    return true;
  }
  if (contactType === "whatsapp" && process.env.WHATSAPP_API_KEY) return true;
  if (contactType === "sms" && process.env.SMS_API_KEY) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const { contact_type, contact_value } = await req.json().catch(() => ({}));
  if (!contact_type || !contact_value || !supabaseAdmin) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 5 * 60_000).toISOString();
  const { error } = await supabaseAdmin.from("otp_codes").insert({
    contact_type, contact_value, code, expires_at: expires,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  const sent = await sendOtp(contact_type, contact_value, code);
  if (!sent) return NextResponse.json({ ok: false, reason: "no_provider" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
