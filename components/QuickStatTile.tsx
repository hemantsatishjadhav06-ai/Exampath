/** Compact stat tile (ported from the sarkari-result build). */
export default function QuickStatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4 text-center sm:p-5">
      <p className="text-lg font-extrabold sm:text-xl">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
