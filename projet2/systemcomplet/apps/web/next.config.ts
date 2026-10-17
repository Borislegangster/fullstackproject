import type { NextConfig } from "next";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), display-capture=(self)" },
];

/**
 * Content-Security-Policy de production : seules les origines réellement utilisées sont autorisées (balises de mesure
 * chargées après consentement, vidéos YouTube / Vimeo, carte OpenStreetMap, visionneuse Autodesk APS, WebSocket).
 * Les visionneuses 3D / BIM (web-ifc en WebAssembly, APS) reçoivent une politique dédiée. `WEB_CSP_EXTRA` permet
 * d'ajouter une origine sans recompiler (ex. CDN média).
 */
function csp(viewer = false): string {
  const extra = (process.env.WEB_CSP_EXTRA ?? "").trim();
  const analytics = "https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com https://snap.licdn.com";
  const aps = "https://developer.api.autodesk.com";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${viewer ? " 'unsafe-eval'" : ""} ${analytics} ${aps} ${extra}`.trim(),
    `style-src 'self' 'unsafe-inline' ${aps}`,
    "img-src 'self' data: blob: https:",
    `font-src 'self' data: ${aps}`,
    "media-src 'self' blob: https:",
    `connect-src 'self' wss: https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://analytics.tiktok.com https://px.ads.linkedin.com https://*.autodesk.com ${extra}`.trim(),
    "frame-src 'self' blob: https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.openstreetmap.org https://www.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https:",
    "frame-ancestors 'self'",
    ...((process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
const VIEWER_ROUTES = ["/erp/hub/:path*", "/erp/bim/:path*", "/espace-client/immersion/:path*", "/embarque/:path*"];

const nextConfig: NextConfig = {
  // `npm run dev:local` travaille dans .next-dev : un build de production lancé en parallèle ne casse pas le serveur de dev.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // En production, nginx route /api et /ws vers l'API ; en développement, Next relaie /api vers FastAPI.
  async rewrites() {
    return process.env.NODE_ENV === "production" && !process.env.WEB_PROXY_API
      ? []
      : [{ source: "/api/v1/:path*", destination: `${API_INTERNAL_URL}/api/v1/:path*` }];
  },
  async headers() {
    const rules = [{ source: "/:path*", headers: securityHeaders }];
    // En développement, le rechargement à chaud de Next exige eval : la CSP n'est appliquée qu'en production.
    if (process.env.NODE_ENV === "production") {
      rules.push({ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: csp() }] });
      for (const source of VIEWER_ROUTES) rules.push({ source, headers: [{ key: "Content-Security-Policy", value: csp(true) }] });
    }
    return rules;
  },
  images: { unoptimized: true },
};

export default nextConfig;
