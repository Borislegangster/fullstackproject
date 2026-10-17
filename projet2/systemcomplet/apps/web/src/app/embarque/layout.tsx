import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "GLOBUS ENGINEERING", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#141f3b" };

/**
 * Pages embarquées dans les applications mobiles (vue web) : visionneuses 3D uniquement, sans navigation du site.
 * La session web y est ouverte par la passerelle à usage unique de l'API (/auth/web-session).
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden bg-brand-900 text-white">{children}</div>;
}
