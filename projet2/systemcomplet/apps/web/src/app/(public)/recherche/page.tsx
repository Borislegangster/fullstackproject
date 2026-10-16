import { ArrowRight, SearchX, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/site/page-view";
import { Highlighted, SiteSearchForm } from "@/components/site/site-search";
import { publicGet } from "@/lib/server-api";

export const metadata: Metadata = { title: "Recherche", robots: { index: false, follow: true } };

const TYPE_LABELS: Record<string, string> = {
  page: "Page",
  universes: "Univers",
  offers: "Offre",
  expertises: "Expertise",
  services: "Service",
  projects: "Réalisation",
  blog_posts: "Article",
  help_articles: "Aide",
  faq: "FAQ",
};

const SHORTCUTS = [
  { href: "/offres", label: "Nos offres" },
  { href: "/expertises", label: "Expertises" },
  { href: "/projets", label: "Réalisations" },
  { href: "/faq", label: "Questions fréquentes" },
  { href: "/contact", label: "Contact" },
  { href: "/decrire-mon-projet", label: "Décrire mon projet" },
];

interface SearchResult {
  type: string;
  title: string;
  path: string | null;
  excerpt?: string | null;
  marks?: number[][];
}

interface SearchResponse {
  total: number;
  partial: boolean;
  results: SearchResult[];
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : (q ?? "")).trim().slice(0, 100);
  let data: SearchResponse | null = null;
  let failed = false;
  if (query.length >= 2) {
    try {
      data = await publicGet<SearchResponse>("/public/search", { q: query }, { fresh: true });
    } catch {
      failed = true;
    }
  }
  const results = (data?.results ?? []).filter((r) => r.path);

  return (
    <>
      <PageHeader title="Rechercher sur le site" crumbs={[{ name: "Accueil", path: "/" }, { name: "Recherche", path: "/recherche" }]}>
        <div className="mt-6">
          <SiteSearchForm query={query} autoFocus={!query} />
        </div>
      </PageHeader>
      <section className="bg-surface py-12 lg:py-20">
        <div className="container-page max-w-3xl">
          {query.length === 1 ? <p className="mb-6 text-muted">Saisissez au moins deux caractères.</p> : null}
          {failed ? (
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-5 text-amber-900 ring-1 ring-amber-200" role="alert">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p>La recherche est momentanément indisponible. Réessayez dans un instant ou parcourez les rubriques ci-dessous.</p>
            </div>
          ) : null}
          {data && results.length ? (
            <>
              <p className="mb-5 text-sm text-muted" aria-live="polite">
                {data.partial ? (
                  <>
                    Aucune page ne contient tous les mots de « <strong className="text-ink">{query}</strong> » : voici les résultats les plus proches.
                  </>
                ) : (
                  <>
                    <strong className="text-ink">{results.length}</strong> résultat{results.length > 1 ? "s" : ""} pour « <strong className="text-ink">{query}</strong> »
                  </>
                )}
              </p>
              <ul className="space-y-3">
                {results.map((r, i) => (
                  <li key={`${r.path}-${i}`}>
                    <Link href={r.path!} className="group block rounded-2xl bg-white p-5 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-300">
                      <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">{TYPE_LABELS[r.type] ?? r.type}</p>
                      <p className="mt-1 flex items-center justify-between gap-2 font-semibold text-brand-800">
                        {r.title}
                        <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </p>
                      {r.excerpt ? (
                        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">
                          <Highlighted text={r.excerpt} marks={r.marks} />
                        </p>
                      ) : null}
                      <p className="mt-2 truncate text-xs text-brand-500">{r.path}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {data && !results.length ? (
            <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-line">
              <SearchX className="mx-auto h-10 w-10 text-brand-300" />
              <p className="mt-3 font-semibold text-ink">Aucun résultat pour « {query} »</p>
              <p className="mt-1 text-sm text-muted">Vérifiez l&apos;orthographe, essayez un mot plus général ou décrivez-nous directement votre projet.</p>
            </div>
          ) : null}
          {!results.length ? (
            <div className="mt-8">
              <p className="mb-3 text-sm font-semibold text-ink">{query ? "Parcourir le site" : "Accès rapides"}</p>
              <div className="flex flex-wrap gap-2">
                {SHORTCUTS.map((s) => (
                  <Link key={s.href} href={s.href} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-700 ring-1 ring-line transition hover:bg-brand-50 hover:ring-brand-300">
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
