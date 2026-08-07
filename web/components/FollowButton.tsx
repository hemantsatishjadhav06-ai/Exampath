"use client";

import { useEffect, useState } from "react";

const FKEY = "exampath:following";

function readFollowing(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(FKEY) || "[]");
  } catch {
    return [];
  }
}
function writeFollowing(list: string[]) {
  try {
    window.localStorage.setItem(FKEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export default function FollowButton({
  id,
  variant = "heart",
}: {
  id: string;
  variant?: "heart" | "button";
}) {
  // Render the unfollowed state on the server and first client paint, then
  // reconcile from localStorage after mount — keeps hydration stable.
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setFollowing(readFollowing().includes(id));
  }, [id]);

  function toggle(e: { preventDefault: () => void; stopPropagation: () => void }) {
    e.preventDefault();
    e.stopPropagation();
    const list = readFollowing();
    const i = list.indexOf(id);
    if (i === -1) list.push(id);
    else list.splice(i, 1);
    writeFollowing(list);
    setFollowing(i === -1);
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        className={`btn ${following ? "ghost" : "saf"}`}
        onClick={toggle}
        aria-pressed={following}
        style={following ? { background: "#fff", color: "var(--brand)" } : undefined}
      >
        {following ? "✓ Following" : "☆ Follow this exam"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`heart ${following ? "on" : ""}`}
      onClick={toggle}
      aria-label="Follow this exam"
      aria-pressed={following}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={following ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 21s-7-4.35-9.5-8.5C.5 9 2.5 5.5 6 5.5c2 0 3.2 1 4 2.2.8-1.2 2-2.2 4-2.2 3.5 0 5.5 3.5 3.5 7C19 16.65 12 21 12 21z" />
      </svg>
    </button>
  );
}
