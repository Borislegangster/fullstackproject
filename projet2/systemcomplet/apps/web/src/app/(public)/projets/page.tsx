import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectCards } from "@/components/site/blocks";
import { CmsPageView, PageHeader } from "@/components/site/page-view";
import { Pager } from "@/components/site/pager";
import { UrlFilters } from "@/components/site/url-filters";
import { getPage, listingMetadata, safe, withoutBlocks } from "@/lib/cms";
import type { ProjectCard } from "@/lib/cms-types";
import { optionLabel } from "@/lib/labels";
import { publicGet } from "@/lib/server-api";

type SP = Promise<Record<string, string | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const meta = await listingMetadata("projects", "Nos réalisations", "/projets");
  // Canonicalisation : les pages filtrées pointent vers la liste principale.
  if (Object.keys(sp).some((k) => k !== "page")) return { ...meta, robots: { index: false, follow: true } };
  return meta;
}

interface Result {
  items: ProjectCard[];
  total: number;
  page: number;
  pages: number;
  facets: { universes: string[]; categories: string[]; cities: string[] };
}

export default async function ProjectsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const [cms, data] = await Promise.all([
    getPage("projects"),
    safe(
      publicGet<Result>("/public/projects", { page, page_size: 12, universe: sp.univers, category: sp.categorie, city: sp.ville, status: sp.statut, q: sp.q }),
      { items: [], total: 0, page: 1, pages: 0, facets: { universes: [], categories: [], cities: [] } } as Result,
    ),
  ]);
  const listing = (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page">
        <div className="mb-8">
          <Suspense>
            <UrlFilters
              placeholder="Rechercher une réalisation"
              filters={[
                { key: "univers", label: "Univers", options: data.facets.universes.map((u) => ({ value: u, label: optionLabel(u) })) },
                { key: "categorie", label: "Catégorie", options: data.facets.categories.map((c) => ({ value: c, label: c })) },
                { key: "ville", label: "Ville", options: data.facets.cities.map((c) => ({ value: c, label: c })) },
              ]}
            />
          </Suspense>
        </div>
        {data.items.length ? (
          <>
            <p className="mb-4 text-sm text-muted">
              {data.total} réalisation{data.total > 1 ? "s" : ""}
            </p>
            <ProjectCards items={data.items} />
            <Pager page={data.page} pages={data.pages} basePath="/projets" params={sp} />
          </>
        ) : (
          <p className="rounded-2xl bg-white p-10 text-center text-muted ring-1 ring-line">Aucune réalisation publiée ne correspond à votre recherche.</p>
        )}
      </div>
    </section>
  );
  if (!cms)
    return (
      <>
        <PageHeader title="Nos réalisations" crumbs={[{ name: "Accueil", path: "/" }, { name: "Réalisations", path: "/projets" }]} />
        {listing}
      </>
    );
  return <CmsPageView page={withoutBlocks(cms, ["projects"])} after={listing} />;
}
