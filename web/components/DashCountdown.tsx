"use client";

import { useEffect, useState } from "react";

// Live Days/Hours/Mins box for the exam hero. First paint shows the build-time
// day count with "–" for hours/mins (identical on server + client), then the
// mounted effect fills in the live values.
export default function DashCountdown({
  iso,
  initialDays,
}: {
  iso: string;
  initialDays: number;
}) {
  const [t, setT] = useState<{ d: number; h: number | string; m: number | string }>({
    d: initialDays,
    h: "–",
    m: "–",
  });

  useEffect(() => {
    const tick = () => {
      const target = new Date(iso + "T23:59:59").getTime();
      let diff = Math.max(0, target - Date.now());
      const dd = Math.floor(diff / 86400000);
      diff -= dd * 86400000;
      const hh = Math.floor(diff / 3600000);
      diff -= hh * 3600000;
      const mm = Math.floor(diff / 60000);
      setT({ d: dd, h: hh, m: mm });
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, [iso]);

  return (
    <div className="countbox">
      <div className="count-unit">
        <b>{t.d}</b>
        <span>Days</span>
      </div>
      <div className="count-unit">
        <b>{t.h}</b>
        <span>Hours</span>
      </div>
      <div className="count-unit">
        <b>{t.m}</b>
        <span>Mins</span>
      </div>
    </div>
  );
}
