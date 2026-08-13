import { NextRequest, NextResponse } from "next/server";

// en lives at the root (no /en in the URL); hi lives under /hi.
// Internally both render through app/[locale] — we rewrite the root to /en.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api") || pathname.startsWith("/_next") ||
    pathname.startsWith("/hi/") || pathname === "/hi" ||
    pathname.startsWith("/en/") || pathname === "/en" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    // A literal /en URL should not exist publicly — redirect to the clean root.
    if (pathname === "/en" || pathname.startsWith("/en/")) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.replace(/^\/en/, "") || "/";
      return NextResponse.redirect(url, 308);
    }
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = `/en${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
