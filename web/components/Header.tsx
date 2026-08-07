"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

function activeBaseFor(pathname: string): string {
  if (pathname === "/") return "/";
  const base = "/" + (pathname.split("/")[1] || "");
  if (base === "/calendar") return "/calendar";
  if (base === "/search") return "/search";
  if (["/bodies", "/body", "/exam"].includes(base)) return "/bodies";
  return "";
}

export default function Header() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [q, setQ] = useState("");
  const active = activeBaseFor(pathname);
  const cls = (href: string) => (active === href ? "active" : "");

  function submit() {
    router.push("/search/?q=" + encodeURIComponent(q));
  }

  return (
    <header className="top">
      <div className="wrap bar">
        <Link className="logo" href="/">
          <span className="glyph"> E</span>
          <span>
            <b>Exam</b>
            <i>Path</i>
          </span>
        </Link>
        <nav className="navlinks">
          <Link href="/" className={cls("/")}>
            Home
          </Link>
          <Link href="/bodies/" className={cls("/bodies")}>
            Exams
          </Link>
          <Link href="/calendar/" className={cls("/calendar")}>
            Calendar
          </Link>
          <Link href="/search/" className={cls("/search")}>
            Search
          </Link>
        </nav>
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="topSearch"
            placeholder="Search exams, e.g. SSC, age 21, graduate…"
            aria-label="Search exams"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <Link className="btn-login" href="/search/">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          Login
        </Link>
      </div>
    </header>
  );
}
