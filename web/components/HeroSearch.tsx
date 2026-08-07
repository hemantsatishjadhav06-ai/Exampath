"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      className="searchbig"
      onSubmit={(e) => {
        e.preventDefault();
        router.push("/search/?q=" + encodeURIComponent(q));
      }}
    >
      <input
        id="heroSearch"
        name="q"
        placeholder={"Try “SSC graduate”, “age 21”, or “bank exams”…"}
        aria-label="Search exams"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button className="btn saf" type="submit">
        Search
      </button>
    </form>
  );
}
