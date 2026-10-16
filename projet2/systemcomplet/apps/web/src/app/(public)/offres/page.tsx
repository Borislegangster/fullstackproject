import type { Metadata } from "next";

import { UniverseCards } from "@/components/site/blocks";
import { CmsPageView, EmptyPublicState, PageHeader } from "@/components/site/page-view";
import { getPage, listingMetadata, safe, withoutBlocks } from "@/lib/cms";
import type { UniverseCard } from "@/lib/cms-types";
import { publicGet } from "@/lib/server-api";

export function generateMetadata(): Promise<Metadata> {
  return listingMetadata("offers", "Nos offres", "/offres");
}

export default async function OffersPage() {
  const [page, universes] = await Promise.all([getPage("offers"), safe(publicGet<UniverseCard[]>("/public/universes"), [])]);
  const list = universes.length ? (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page">
        <UniverseCards items={universes} />
      </div>
    </section>
  ) : (
    <EmptyPublicState title="Aucune offre publiée" text="Les univers et offres seront bientôt disponibles." />
  );
  if (!page)
    return (
      <>
        <PageHeader title="Nos offres" crumbs={[{ name: "Accueil", path: "/" }, { name: "Offres", path: "/offres" }]} />
        {list}
      </>
    );
  return <CmsPageView page={withoutBlocks(page, ["universes"])} after={list} />;
}
