import type { Metadata } from "next";

import { FeatureGrid } from "@/components/site/blocks";
import { optionLabel } from "@/lib/labels";
import { CmsPageView, EmptyPublicState, PageHeader } from "@/components/site/page-view";
import { getPage, listingMetadata, safe, withoutBlocks } from "@/lib/cms";
import { publicGet } from "@/lib/server-api";

export function generateMetadata(): Promise<Metadata> {
  return listingMetadata("expertises", "Nos expertises", "/expertises");
}

export default async function ExpertisesPage() {
  const [page, items] = await Promise.all([getPage("expertises"), safe(publicGet<any[]>("/public/expertises"), [])]);
  const list = items.length ? (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page">
        <FeatureGrid columns={3} items={items.map((e) => ({ icon: e.icon ?? "compass", title: e.name, text: [e.discipline ? optionLabel(e.discipline) : null, e.summary].filter(Boolean).join(" — "), href: e.path, media: e.media }))} />
      </div>
    </section>
  ) : (
    <EmptyPublicState title="Aucune expertise publiée" />
  );
  if (!page)
    return (
      <>
        <PageHeader title="Nos expertises" crumbs={[{ name: "Accueil", path: "/" }, { name: "Expertises", path: "/expertises" }]} />
        {list}
      </>
    );
  return <CmsPageView page={withoutBlocks(page, ["expertises"])} after={list} />;
}
