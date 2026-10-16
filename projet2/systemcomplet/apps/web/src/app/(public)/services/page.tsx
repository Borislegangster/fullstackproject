import type { Metadata } from "next";

import { FeatureGrid } from "@/components/site/blocks";
import { optionLabel } from "@/lib/labels";
import { CmsPageView, EmptyPublicState, PageHeader } from "@/components/site/page-view";
import { getPage, listingMetadata, safe, withoutBlocks } from "@/lib/cms";
import { publicGet } from "@/lib/server-api";

export function generateMetadata(): Promise<Metadata> {
  return listingMetadata("services", "Nos services", "/services");
}

export default async function ServicesPage() {
  const [page, items] = await Promise.all([getPage("services"), safe(publicGet<any[]>("/public/services"), [])]);
  const groups = new Map<string, any[]>();
  items.forEach((s) => {
    const key = s.category || "Autres services";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  });
  const list = items.length ? (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page space-y-20">
        {[...groups.entries()].map(([category, services]) => (
          <div key={category}>
            <p className="eyebrow text-accent-600">{services.length} service{services.length > 1 ? "s" : ""}</p>
            <h2 className="mb-10 mt-3 font-title text-3xl font-bold text-brand-900 sm:text-4xl">{optionLabel(category)}</h2>
            <FeatureGrid columns={3} items={services.map((x) => ({ icon: x.icon ?? "check", title: x.name, text: x.summary, href: x.path, media: x.media }))} />
          </div>
        ))}
      </div>
    </section>
  ) : (
    <EmptyPublicState title="Aucun service publié" />
  );
  if (!page)
    return (
      <>
        <PageHeader title="Nos services" crumbs={[{ name: "Accueil", path: "/" }, { name: "Services", path: "/services" }]} />
        {list}
      </>
    );
  return <CmsPageView page={withoutBlocks(page, ["services"])} after={list} />;
}
