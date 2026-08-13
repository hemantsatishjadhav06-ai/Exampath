"use client";
/** Reserved-size lazy ad slot. Max 3 call sites per page by design — do not add
 * more. Renders nothing until an ad provider is configured. */
export default function AdSlot({ slot, height = 90 }: { slot: string; height?: number }) {
  const enabled = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!enabled) return null;
  return (
    <div data-ad-slot={slot} style={{ minHeight: height }}
      className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-[11px] uppercase tracking-wide text-slate-300">
      ad
    </div>
  );
}
