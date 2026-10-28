import type { MetadataRoute } from "next";

// Let the survey be found by link previews, but keep the admin panel and APIs out of search engines.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] } };
}
