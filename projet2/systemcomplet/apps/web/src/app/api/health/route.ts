import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Sonde de vivacité du serveur web (healthcheck conteneur ; non exposée par nginx). */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
