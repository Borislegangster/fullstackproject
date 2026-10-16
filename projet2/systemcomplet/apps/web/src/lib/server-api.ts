import "server-only";

/** Lecture côté serveur (rendu de la vitrine) des points d'API publics, avec cache de données révalidable. */
const API = (process.env.API_INTERNAL_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const CMS_TAG = "cms";
const REVALIDATE_SECONDS = Number(process.env.CMS_REVALIDATE_SECONDS ?? 60);

export class NotFoundError extends Error {}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return `${API}/api/v1${path}${qs ? `?${qs}` : ""}`;
}

export async function publicGet<T = any>(path: string, query?: Query, opts: { fresh?: boolean } = {}): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    headers: { Accept: "application/json", "X-Client-App": "web" },
    ...(opts.fresh ? { cache: "no-store" as const } : { next: { revalidate: REVALIDATE_SECONDS, tags: [CMS_TAG] } }),
  });
  if (response.status === 404) throw new NotFoundError(path);
  if (!response.ok) throw new Error(`API ${response.status} sur ${path}`);
  return response.json() as Promise<T>;
}

export async function publicGetOrNull<T = any>(path: string, query?: Query, opts: { fresh?: boolean } = {}): Promise<T | null> {
  try {
    return await publicGet<T>(path, query, opts);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

/** Variante tolérante : renvoie `fallback` si l'API est indisponible (la page affiche alors un état vide explicite). */
export async function publicGetSafe<T = any>(path: string, fallback: T, query?: Query, opts: { fresh?: boolean } = {}): Promise<T> {
  try {
    return await publicGet<T>(path, query, opts);
  } catch {
    return fallback;
  }
}

export function siteUrl(path = ""): string {
  return `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

export function apiInternalUrl(): string {
  return API;
}
