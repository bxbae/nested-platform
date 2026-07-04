import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // keep private consoles out of the index
      disallow: ["/admin", "/me", "/host"],
    },
    sitemap: "https://nested.kr/sitemap.xml",
  };
}
