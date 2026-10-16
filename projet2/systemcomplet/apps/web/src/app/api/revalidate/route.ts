import { timingSafeEqual } from "node:crypto";

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { CMS_TAG } from "@/lib/server-api";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Revalidation à la demande déclenchée par l'API lors des publications CMS (secret partagé). */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided = request.headers.get("x-revalidate-secret") ?? "";
  if (!secret || !safeEqual(provided, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let paths: string[] = [];
  try {
    const body = (await request.json()) as { paths?: unknown };
    if (Array.isArray(body.paths)) paths = body.paths.filter((p): p is string => typeof p === "string" && p.startsWith("/")).slice(0, 100);
  } catch {
    /* corps vide : revalidation globale */
  }
  revalidateTag(CMS_TAG);
  paths.forEach((p) => revalidatePath(p));
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ revalidated: true, paths });
}
