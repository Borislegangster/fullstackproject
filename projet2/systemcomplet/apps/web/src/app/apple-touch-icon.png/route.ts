import { brandFileResponse } from "@/lib/brand";

export const dynamic = "force-dynamic";

/** /apple-touch-icon.png : raccourci iOS (fond plein), décliné de l'icône unique de la plateforme. */
export function GET(): Promise<Response> {
  return brandFileResponse("apple-touch-icon.png", "image/png");
}
