import { cookies, draftMode } from "next/headers";

import { publicGetOrNull } from "@/lib/server-api";

/** Cookie posé par /api/apercu (jeton signé par l'API, 30 min) : aperçu d'un contenu non publié. */
export const PREVIEW_COOKIE = "globus_apercu";

/**
 * En mode aperçu (Draft Mode Next.js activé depuis l'ERP), renvoie la page de détail du brouillon si elle correspond
 * à la collection et au slug demandés ; sinon null (rendu public normal, statique et mis en cache).
 */
export async function previewDetail<T extends { slug?: string }>(kind: string, slug: string): Promise<T | null> {
  if (!(await draftMode()).isEnabled) return null;
  const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!token) return null;
  try {
    const data = await publicGetOrNull<{ kind: string; detail: T }>(`/public/preview/${encodeURIComponent(token)}`, undefined, { fresh: true });
    if (!data || data.kind !== kind || data.detail?.slug !== slug) return null;
    return data.detail;
  } catch {
    return null;
  }
}
