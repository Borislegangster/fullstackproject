import { cookies, draftMode } from "next/headers";
import { cache } from "react";

import type { PagePayload } from "@/lib/cms-types";
import { publicGetOrNull } from "@/lib/server-api";

/** Cookie posé par /api/apercu (jeton signé par l'API, 30 min) : aperçu d'un contenu non publié. */
export const PREVIEW_COOKIE = "globus_apercu";

type PreviewData = { kind: string; detail: any };

/** Contenu désigné par le jeton d'aperçu (lu une fois par rendu) ; null hors mode aperçu. */
const previewData = cache(async (): Promise<PreviewData | null> => {
  if (!(await draftMode()).isEnabled) return null;
  const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!token) return null;
  try {
    return await publicGetOrNull<PreviewData>(`/public/preview/${encodeURIComponent(token)}`, undefined, { fresh: true });
  } catch {
    return null;
  }
});

/**
 * En mode aperçu (Draft Mode Next.js activé depuis l'ERP), renvoie la page de détail du brouillon si elle correspond
 * à la collection et au slug demandés ; sinon null (rendu public normal, statique et mis en cache).
 */
export async function previewDetail<T extends { slug?: string }>(kind: string, slug: string): Promise<T | null> {
  const data = await previewData();
  if (!data || data.kind !== kind || data.detail?.slug !== slug) return null;
  return data.detail as T;
}

/**
 * Page CMS en aperçu (brouillon, ou page telle qu'elle sera une fois la proposition de l'assistant du site
 * appliquée) si elle correspond à la page demandée (clé de route ou chemin) ; sinon null.
 */
export async function previewPage(match: { routeKey?: string; path?: string }): Promise<PagePayload | null> {
  const data = await previewData();
  if (!data || data.kind !== "page" || !data.detail) return null;
  const page = data.detail as PagePayload;
  if (match.routeKey && page.route_key === match.routeKey) return page;
  if (match.path && page.path === match.path) return page;
  return null;
}
