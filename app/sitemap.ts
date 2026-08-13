import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/site-config";
import { getBodies, getCycles } from "@/lib/queries";

/** Sitemap split by content type via generateSitemaps (index is served by Next). */
export async function generateSitemaps() {
  return [{ id: "static" }, { id: "exams" }, { id: "bodies" }];
}

export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const both = (p: string): MetadataRoute.Sitemap => [
    { url: `${baseUrl}${p}`, lastModified: now },
    { url: `${baseUrl}/hi${p === "/" ? "" : p}`, lastModified: now },
  ];
  if (id === "static") {
    return ["/", "/search", "/calendar", "/bodies", "/about", "/contact", "/privacy-policy", "/disclaimer", "/terms",
      "/category/qualification/10th", "/category/qualification/12th", "/category/qualification/graduate", "/category/qualification/pg",
    ].flatMap(both);
  }
  if (id === "bodies") {
    const bodies = await getBodies();
    return bodies.flatMap((b) => both(`/body/${b.slug}`));
  }
  const cycles = await getCycles();
  return cycles.flatMap((c) =>
    ["", "/apply", "/syllabus", "/exam-pattern", "/cutoff", "/admit-card", "/result"]
      .flatMap((seg) => both(`/exam/${c.id}${seg}`)));
}
