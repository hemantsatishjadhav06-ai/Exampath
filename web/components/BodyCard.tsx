import Link from "next/link";
import type { Body } from "@/lib/types";
import { cyclesByBody } from "@/lib/data";

export default function BodyCard({ body }: { body: Body }) {
  const n = cyclesByBody(body.slug).length;
  return (
    <Link className="bcard" href={`/body/${body.slug}/`}>
      <div className="ic" style={{ background: body.color }}>
        {body.short}
      </div>
      <b>{body.short}</b>
      <span>
        {n} exam{n > 1 ? "s" : ""} &middot; {body.level}
      </span>
    </Link>
  );
}
