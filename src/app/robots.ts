import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/data/"],
    },
    sitemap: "https://conformal.live/sitemap.xml",
    host: "https://conformal.live",
  };
}
