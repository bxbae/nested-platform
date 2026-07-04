import type { MetadataRoute } from "next";
import { houses } from "@/lib/data";

// Auto-generated sitemap covering static routes + every listing detail page.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nested.kr";
  const staticRoutes = ["", "/search", "/browse", "/match", "/community"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const listingRoutes = houses.map((h) => ({
    url: `${base}/homes/${h.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...listingRoutes];
}
