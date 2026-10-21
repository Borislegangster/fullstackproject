import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/toast";
import { getBrand } from "@/lib/brand";

import { doxent, gilroy } from "./fonts";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Icône unique de la plateforme (réglage CMS) pour tous les espaces : vitrine, espace client, ERP, extranet. */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    metadataBase: new URL(siteUrl),
    applicationName: brand?.name ?? "GLOBUS ENGINEERING",
    // Adresses à la racine du site (relais de l'API) : Google et Bing ne lisent pas /api/ (robots.txt) ; Google exige
    // une icône de 48 px ou d'un multiple de 48 px.
    icons: brand
      ? {
          icon: [
            { url: `/favicon.ico?v=${brand.version}`, sizes: "any" },
            { url: `/icons/icon-48.png?v=${brand.version}`, sizes: "48x48", type: "image/png" },
            { url: `/icons/icon-96.png?v=${brand.version}`, sizes: "96x96", type: "image/png" },
            { url: `/icons/icon-192.png?v=${brand.version}`, sizes: "192x192", type: "image/png" },
          ],
          apple: [{ url: `/apple-touch-icon.png?v=${brand.version}`, sizes: "180x180", type: "image/png" }],
        }
      : { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#385AA6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${gilroy.variable} ${doxent.variable}`}>
      <body>
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">
          Aller au contenu
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
