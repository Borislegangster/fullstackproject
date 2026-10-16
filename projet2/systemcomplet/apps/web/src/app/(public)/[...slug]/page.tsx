import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { CmsPageView } from "@/components/site/page-view";
import type { PagePayload } from "@/lib/cms-types";
import { buildMetadata, getSite } from "@/lib/seo";
import { publicGetOrNull } from "@/lib/server-api";

type Resolved = { type: "page"; page: PagePayload } | { type: "redirect"; target: string; status: number };

async function resolve(slug: string[]): Promise<Resolved | null> {
  const path = "/" + slug.map((s) => decodeURIComponent(s)).join("/");
  if (path.length > 500) return null;
  try {
    return await publicGetOrNull<Resolved>("/public/resolve", { path });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const [site, resolved] = await Promise.all([getSite(), resolve(slug)]);
  if (!resolved || resolved.type !== "page") return { title: "Page introuvable", robots: { index: false } };
  const page = resolved.page;
  return buildMetadata({ site, seo: page.seo, title: page.title, description: page.summary, path: page.path });
}

/** Pages CMS à chemin libre (à propos, contact, pages légales, pages d'atterrissage…) et redirections 301/410. */
export default async function CmsCatchAllPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const resolved = await resolve(slug);
  if (!resolved) notFound();
  if (resolved.type === "redirect") {
    if (resolved.status === 410) notFound();
    if (resolved.status === 301 || resolved.status === 308) permanentRedirect(resolved.target);
    redirect(resolved.target);
  }
  return <CmsPageView page={resolved.page} />;
}
