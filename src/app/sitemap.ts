import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://conformal.live/",
      lastModified: new Date("2026-05-11"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
