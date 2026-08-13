/** Trademark-safe monogram emblem for a conducting body. */
export default function Emblem({ short, color, size = 40 }: { short: string; color?: string | null; size?: number }) {
  const c = color || "#4f46e5";
  const text = short.slice(0, 5);
  const fs = text.length >= 5 ? 9 : text.length === 4 ? 10.5 : text.length === 3 ? 12.5 : 15;
  return (
    <span aria-hidden className="grid flex-none place-items-center font-extrabold text-white"
      style={{ width: size, height: size, borderRadius: size * 0.28, fontSize: fs,
        background: `linear-gradient(140deg, ${c}, color-mix(in srgb, ${c} 60%, #000))`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" }}>
      {text}
    </span>
  );
}
