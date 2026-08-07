"use client";

import { useEffect, useState } from "react";

// Renders the build-time `initialDays` first (matching the server HTML), then
// recomputes live after mount — no hydration mismatch.
export default function Countdown({
  iso,
  initialDays,
}: {
  iso: string;
  initialDays: number;
}) {
  const [days, setDays] = useState(initialDays);

  useEffect(() => {
    const tick = () =>
      setDays(Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)));
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [iso]);

  return (
    <>
      {days}
      <small> days left</small>
    </>
  );
}
