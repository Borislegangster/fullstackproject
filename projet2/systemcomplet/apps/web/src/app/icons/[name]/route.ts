import { brandFileResponse } from "@/lib/brand";

export const dynamic = "force-dynamic";

// Déclinaisons servies à la racine du site (/icons/…) : les moteurs de recherche ne lisent pas /api/ (robots.txt) et
// n'afficheraient pas l'icône dans leurs résultats.
const ALLOWED = /^(icon-(16|32|48|64|96|128|152|167|180|192|256|384|512|1024)|icon-maskable-(192|512))\.png$/;

/** /icons/icon-192.png… : icône unique de la plateforme (réglage CMS), relayée depuis l'API. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const { name } = await params;
  if (!ALLOWED.test(name)) return new Response(null, { status: 404 });
  return brandFileResponse(name, "image/png");
}
