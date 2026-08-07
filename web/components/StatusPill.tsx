import { STATUS_META, type Status } from "@/lib/types";

export default function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status] ?? STATUS_META.upcoming;
  return (
    <span className={`pill ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  );
}
