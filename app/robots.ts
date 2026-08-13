import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: [`${baseUrl}/sitemap/static.xml`, `${baseUrl}/sitemap/exams.xml`, `${baseUrl}/sitemap/bodies.xml`],
  };
}
