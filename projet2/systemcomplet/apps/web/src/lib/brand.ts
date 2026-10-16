import "server-only";

import { apiInternalUrl, publicGetSafe } from "@/lib/server-api";

/** Icône unique de la plateforme (réglage CMS « Icône de la plateforme »), versionnée par l'API. */
export interface Brand {
  name: string;
  short_name: string;
  theme_color: string;
  background_color: string;
  version: string;
  origin: "custom" | "default";
  icon: string;
  favicon: string;
  favicon_png: string;
  apple_touch_icon: string;
  sizes: Record<string, string>;
  icons: { src: string; sizes: string; type: string; purpose: "any" | "maskable" }[];
}

/** URL d'icône de repli (sans version) si l'API est momentanément indisponible. */
export const BRAND_ICON_FALLBACK = "/api/v1/public/brand/icon-192.png";

export async function getBrand(): Promise<Brand | null> {
  return publicGetSafe<Brand | null>("/public/brand", null);
}

/** Relais d'une déclinaison d'icône de l'API (adresses que les navigateurs demandent d'office : /favicon.ico…). */
export async function brandFileResponse(name: string, contentType: string): Promise<Response> {
  try {
    const upstream = await fetch(`${apiInternalUrl()}/api/v1/public/brand/${name}`, { cache: "no-store" });
    if (!upstream.ok) return new Response(null, { status: upstream.status });
    return new Response(await upstream.arrayBuffer(), {
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
