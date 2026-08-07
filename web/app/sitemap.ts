import type { MetadataRoute } from "next";
import { getBodies, getCycles } from "@/lib/data";

const SITE = "https://exampath.example";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = ["/", "/bodies/", "/calendar/", "/search/"];
  getBodies().forEach((b) => paths.push(`/body/${b.slug}/`));
  getCycles().forEach((c) => paths.push(`/exam/${c.id}/`));
  return paths.map((p) => ({
    url: `${SITE}${p}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: p === "/" ? 1 : 0.7,
  }));
}
