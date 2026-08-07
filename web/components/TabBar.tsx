"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function activeBaseFor(pathname: string): string {
  if (pathname === "/") return "/";
  const base = "/" + (pathname.split("/")[1] || "");
  if (base === "/calendar") return "/calendar";
  if (base === "/search") return "/search";
  if (["/bodies", "/body", "/exam"].includes(base)) return "/bodies";
  return "";
}

export default function TabBar() {
  const pathname = usePathname() || "/";
  const active = activeBaseFor(pathname);
  const cls = (href: string) => (active === href ? "active" : "");

  return (
    <nav className="tabbar">
      <Link href="/" className={cls("/")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
        Home
      </Link>
      <Link href="/bodies/" className={cls("/bodies")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 4v16" />
        </svg>
        Exams
      </Link>
      <Link href="/calendar/" className={cls("/calendar")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18M8 2v4M16 2v4" />
        </svg>
        Calendar
      </Link>
      <Link href="/search/" className={cls("/search")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        Search
      </Link>
    </nav>
  );
}
