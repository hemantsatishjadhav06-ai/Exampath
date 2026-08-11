import type { MetadataRoute } from "next";
import { getBodies, getCycles } from "@/lib/data";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://exampath.in").replace(/\/$/, "");

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const generatedAt = new Date();
  const paths = ["/", "/bodies/", "/calendar/", "/search/"];
  getBodies().forEach((b) => paths.push(`/body/${b.slug}/`));
  getCycles().forEach((c) => paths.push(`/exam/${c.id}/`));

  return paths.map((p) => ({
    url: `${SITE}${p}`,
    lastModified: generatedAt,
    changeFrequency: p === "/" ? "daily" : "weekly",
    priority: p === "/" ? 1 : p.startsWith("/exam/") ? 0.9 : 0.7,
  }));
}
