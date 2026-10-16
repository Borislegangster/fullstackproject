import "server-only";

import type { Metadata } from "next";

import type { Media, Seo, SitePayload } from "./cms-types";
import { publicGetSafe, siteUrl } from "./server-api";

export async function getSite(): Promise<SitePayload | null> {
  return publicGetSafe<SitePayload | null>("/public/site", null);
}

function absolute(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http") ? url : siteUrl(url);
}

function imageOf(media?: Media | null): string | undefined {
  return absolute(media?.variants?.lg?.url ?? media?.url);
}

/** Métadonnées d'une route indexable : title, description, canonical, robots, OpenGraph, X/Twitter (V4-SEO-08). */
export function buildMetadata({
  site,
  seo,
  title,
  description,
  path,
  image,
  type = "website",
  publishedTime,
}: {
  site: SitePayload | null;
  seo?: Seo | null;
  title: string;
  description?: string | null;
  path: string;
  image?: Media | null;
  type?: "website" | "article";
  publishedTime?: string | null;
}): Metadata {
  const template = site?.seo_title_template && site.seo_title_template.includes("%s") ? site.seo_title_template : "%s";
  const fullTitle = seo?.title || template.replace("%s", title);
  const desc = seo?.description || description || site?.default_meta_description || undefined;
  const canonical = seo?.canonical_url ? absolute(seo.canonical_url) : siteUrl(path);
  const ogImage = imageOf(seo?.og_image) ?? imageOf(image) ?? imageOf(site?.default_og_image);
  const twitterImage = imageOf(seo?.twitter_image) ?? ogImage;
  return {
    title: { absolute: fullTitle },
    description: desc,
    keywords: seo?.keywords?.length ? seo.keywords : undefined,
    alternates: { canonical },
    robots: { index: seo?.robots_index ?? true, follow: seo?.robots_follow ?? true },
    openGraph: {
      type,
      title: seo?.og_title || fullTitle,
      description: seo?.og_description || desc,
      url: canonical,
      siteName: site?.company_name ?? "GLOBUS ENGINEERING",
      locale: "fr_FR",
      images: ogImage ? [{ url: ogImage }] : undefined,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: (seo?.twitter_card as "summary" | "summary_large_image" | undefined) ?? "summary_large_image",
      title: seo?.og_title || fullTitle,
      description: seo?.og_description || desc,
      images: twitterImage ? [twitterImage] : undefined,
    },
    verification: site?.search_console_verification ? { google: site.search_console_verification } : undefined,
  };
}

/** Données structurées schema.org (Organization, WebPage, BreadcrumbList, Article, FAQPage, Service…). */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, "\\u003c") }} />
      ))}
    </>
  );
}

export function organizationLd(site: SitePayload | null): Record<string, unknown> {
  const c = site?.contacts ?? {};
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    name: site?.company_name ?? "GLOBUS ENGINEERING",
    url: siteUrl("/"),
    logo: imageOf(site?.logo) ?? siteUrl("/brand/logo-globus.png"),
    slogan: site?.slogan ?? undefined,
    email: c.email ?? undefined,
    telephone: c.phone ?? undefined,
    address: c.address || c.city ? { "@type": "PostalAddress", streetAddress: c.address ?? undefined, addressLocality: c.city ?? undefined, addressCountry: c.country ?? undefined } : undefined,
    geo: c.latitude && c.longitude ? { "@type": "GeoCoordinates", latitude: c.latitude, longitude: c.longitude } : undefined,
    sameAs: site?.socials?.map((s) => s.url) ?? undefined,
    // note moyenne des seuls avis vérifiés publiés (R6)
    aggregateRating:
      site?.reviews?.count && site.reviews.average
        ? { "@type": "AggregateRating", ratingValue: site.reviews.average, reviewCount: site.reviews.count, bestRating: 5, worstRating: 1 }
        : undefined,
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: siteUrl(it.path) })),
  };
}

export function webPageLd(name: string, path: string, description?: string | null): Record<string, unknown> {
  return { "@context": "https://schema.org", "@type": "WebPage", name, url: siteUrl(path), description: description ?? undefined, inLanguage: "fr" };
}
