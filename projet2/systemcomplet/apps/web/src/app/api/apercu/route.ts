import { cookies, draftMode } from "next/headers";
import type { NextRequest } from "next/server";

import { PREVIEW_COOKIE } from "@/lib/preview";

/**
 * Entrée en mode aperçu depuis l'ERP : active le Draft Mode, mémorise le jeton signé (vérifié par l'API à chaque
 * rendu) puis redirige vers la page publique. Seuls les chemins internes sont acceptés (pas de redirection ouverte).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "/";
  const safePath = /^\/(?!\/)[^\s\\]*$/.test(path) ? path : "/";
  if (!/^[\w.-]{20,2000}$/.test(token)) return new Response("Jeton d'aperçu invalide", { status: 400 });
  (await draftMode()).enable();
  (await cookies()).set(PREVIEW_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
  return new Response(null, { status: 307, headers: { Location: safePath, "Cache-Control": "no-store" } });
}
