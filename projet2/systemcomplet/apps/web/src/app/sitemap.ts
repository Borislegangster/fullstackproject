import type { MetadataRoute } from "next";

import { publicGetSafe, siteUrl } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type Changefreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

/** sitemap.xml dynamique : reflète exactement les contenus publiés et indexables (V4-SEO-09). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await publicGetSafe<{ path: string; lastmod?: string; priority?: number; changefreq?: Changefreq }[]>("/public/sitemap", []);
  return entries.map((e) => ({
    url: siteUrl(e.path),
    lastModified: e.lastmod ? new Date(e.lastmod) : undefined,
    changeFrequency: e.changefreq,
    priority: e.priority,
  }));
}
