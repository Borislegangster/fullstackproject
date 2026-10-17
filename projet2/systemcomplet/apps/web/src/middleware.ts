import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirections SEO administrées depuis le CMS (301/302/307/308) et contenus retirés (410), appliquées avant le rendu
 * pour conserver les vrais codes HTTP. La table est mise en cache 60 s par instance.
 */
type RedirectRule = { source: string; target: string; status: number };

const API = (process.env.API_INTERNAL_URL ?? "http://localhost:8000").replace(/\/$/, "");
let cache: { at: number; map: Map<string, RedirectRule> } | null = null;

async function rules(): Promise<Map<string, RedirectRule>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  try {
    const res = await fetch(`${API}/api/v1/public/redirects`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const list = (await res.json()) as RedirectRule[];
    cache = { at: Date.now(), map: new Map(list.map((r) => [r.source.replace(/\/$/, "") || "/", r])) };
  } catch {
    cache = { at: Date.now(), map: cache?.map ?? new Map() };
  }
  return cache.map;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  const map = await rules();
  const rule = map.get(path);
  if (!rule) return NextResponse.next();
  void fetch(`${API}/api/v1/public/redirects/hit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: rule.source }),
  }).catch(() => undefined);
  if (rule.status === 410) {
    return new NextResponse("<!doctype html><meta charset=utf-8><title>Contenu retiré</title><p>Ce contenu a été définitivement retiré.</p>", {
      status: 410,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  const target = rule.target.startsWith("http") ? rule.target : new URL(rule.target, request.url).toString();
  return NextResponse.redirect(target, rule.status as 301 | 302 | 307 | 308);
}

export const config = {
  matcher: ["/((?!api|_next|erp|espace-client|extranet|embarque|connexion|inscription|activation|brand|fonts|favicon|sitemap.xml|robots.txt|manifest.webmanifest|sw.js|.*\\.[a-zA-Z0-9]+$).*)"],
};
