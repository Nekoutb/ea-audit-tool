import type { MetadataRoute } from "next";

// A private audit platform: search engines may know the door exists, never
// the rooms. Engagement data must not be crawled even if a URL leaks.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/$", "/login"], disallow: ["/"] }],
    sitemap: "https://www.auditisa.com/sitemap.xml",
  };
}
