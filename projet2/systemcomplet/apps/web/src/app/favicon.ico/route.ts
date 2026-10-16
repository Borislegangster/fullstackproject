import { brandFileResponse } from "@/lib/brand";

export const dynamic = "force-dynamic";

/** /favicon.ico : icône unique de la plateforme (réglage CMS). */
export function GET(): Promise<Response> {
  return brandFileResponse("favicon.ico", "image/x-icon");
}
