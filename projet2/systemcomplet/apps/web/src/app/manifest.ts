import type { MetadataRoute } from "next";

import { getBrand } from "@/lib/brand";

/** Application installable (PWA) : nom et icônes issus du réglage CMS « Icône de la plateforme ». */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getBrand();
  return {
    name: brand?.name ?? "GLOBUS ENGINEERING",
    short_name: brand?.short_name ?? "GLOBUS",
    description: "Espace client, ERP et extranet partenaires GLOBUS ENGINEERING",
    start_url: "/connexion",
    display: "standalone",
    background_color: brand?.background_color ?? "#FFFFFF",
    theme_color: brand?.theme_color ?? "#385AA6",
    lang: "fr",
    icons: brand?.icons ?? [
      { src: "/api/v1/public/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/v1/public/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/v1/public/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
