import Link from "next/link";
import { FEED_ICON } from "@/lib/data";

export interface FeedRow {
  cycleId: string;
  title: string;
  text: string;
  kind: string;
  when: string;
}

export default function Feed({
  items,
  link = true,
}: {
  items: FeedRow[];
  link?: boolean;
}) {
  return (
    <div className="feed">
      {items.map((f, i) => {
        const ic = FEED_ICON[f.kind] ?? FEED_ICON.info;
        const inner = (
          <>
            <div className="ic" style={{ background: ic[1] }}>
              {ic[0]}
            </div>
            <div>
              <h4>{f.title}</h4>
              <p>{f.text}</p>
            </div>
            <div className="t">{f.when}</div>
          </>
        );
        return link ? (
          <Link className="it" href={`/exam/${f.cycleId}/`} key={i}>
            {inner}
          </Link>
        ) : (
          <div className="it" style={{ cursor: "default" }} key={i}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
