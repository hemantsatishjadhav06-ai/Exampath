import { NextRequest, NextResponse } from "next/server";
import { issueSession } from "@/lib/session";

/** Email + password login — the second, separate sign-in path.
 *  Credentials are verified by the ExamPath backend (the sibling product's
 *  live auth API), so one account works across both sites; on success we
 *  mint MeraSafar's own session cookie. No password ever stored here. */
const EXAMPATH_API = process.env.EXAMPATH_API_URL || "https://exampath-api-cq29.onrender.com";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) ?? {};
  const { action, email, password, name } = body as {
    action?: string; email?: string; password?: string; name?: string;
  };
  if ((action !== "login" && action !== "register") || typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const payload = action === "register" ? { email, password, name: name || email.split("@")[0] } : { email, password };
  let upstream: Response;
  try {
    upstream = await fetch(`${EXAMPATH_API}/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "upstream_unavailable" }, { status: 502 });
  }
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data.ok) {
    return NextResponse.json({ ok: false, error: data.error ?? "invalid credentials" }, { status: upstream.status || 401 });
  }
  const token = await issueSession(`exampath:${email.trim().toLowerCase()}`);
  const res = NextResponse.json({ ok: true, user: data.user ?? { email } });
  res.cookies.set("ms_session", token, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
