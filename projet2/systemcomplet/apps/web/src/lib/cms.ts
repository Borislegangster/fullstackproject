import "server-only";

import type { Metadata } from "next";

import type { PagePayload, Section } from "./cms-types";
import { buildMetadata, getSite } from "./seo";
import { publicGetOrNull } from "./server-api";

export async function getPage(routeKey: string): Promise<PagePayload | null> {
  try {
    return await publicGetOrNull<PagePayload>(`/public/pages/${routeKey}`);
  } catch {
    return null;
  }
}

/** Métadonnées d'une page de liste pilotée par une page CMS (route_key) avec repli sur un titre système. */
export async function listingMetadata(routeKey: string, fallbackTitle: string, path: string): Promise<Metadata> {
  const [site, page] = await Promise.all([getSite(), getPage(routeKey)]);
  return buildMetadata({ site, seo: page?.seo, title: page?.title ?? fallbackTitle, description: page?.summary, path });
}

/** Retire de la page CMS les blocs d'un type déjà rendus par la liste dynamique (évite les doublons). */
export function withoutBlocks(page: PagePayload, kinds: string[]): PagePayload {
  const sections: Section[] = page.sections
    .map((s) => ({ ...s, blocks: s.blocks.filter((b) => !kinds.includes(b.kind)) }))
    .filter((s) => s.blocks.length > 0);
  return { ...page, sections };
}

export async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}
