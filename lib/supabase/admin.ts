// Service-role client — SERVER ONLY. Import exclusively from app/api/* routes
// that write to app_users / otp_codes / follows / notification_log.
import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseAdmin =
  url && service
    ? createClient(url, service, { auth: { persistSession: false } })
    : null;
