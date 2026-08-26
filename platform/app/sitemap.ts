import type { MetadataRoute } from "next";

/** Only the public surface: the door. Everything else is behind sign-in. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "https://www.auditisa.com";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
