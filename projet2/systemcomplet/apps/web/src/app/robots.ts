import type { MetadataRoute } from "next";

import { publicGetSafe, siteUrl } from "@/lib/server-api";

export const dynamic = "force-dynamic";

/** robots.txt dynamique : interdit l'indexation hors production et des espaces privés. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const data = await publicGetSafe<{ disallow: string[]; extra?: string | null; sitemap: string; allow_indexing: boolean } | null>("/public/robots", null);
  if (!data || !data.allow_indexing) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const extraDisallow = (data.extra ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.toLowerCase().startsWith("disallow:"))
    .map((l) => l.slice(9).trim())
    .filter(Boolean);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...data.disallow, ...extraDisallow] }],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
