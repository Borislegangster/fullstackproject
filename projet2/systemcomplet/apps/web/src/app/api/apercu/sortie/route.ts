import { cookies, draftMode } from "next/headers";
import type { NextRequest } from "next/server";

import { PREVIEW_COOKIE } from "@/lib/preview";

/** Sortie du mode aperçu : retour au site publié. */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "/";
  const safePath = /^\/(?!\/)[^\s\\]*$/.test(path) ? path : "/";
  (await draftMode()).disable();
  (await cookies()).delete(PREVIEW_COOKIE);
  return new Response(null, { status: 307, headers: { Location: safePath, "Cache-Control": "no-store" } });
}
