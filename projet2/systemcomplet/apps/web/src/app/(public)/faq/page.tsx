import type { Metadata } from "next";

import { FaqList } from "@/components/site/blocks";
import { CmsPageView, EmptyPublicState, PageHeader } from "@/components/site/page-view";
import { getPage, listingMetadata, safe, withoutBlocks } from "@/lib/cms";
import { JsonLd } from "@/lib/seo";
import { publicGet } from "@/lib/server-api";

export function generateMetadata(): Promise<Metadata> {
  return listingMetadata("faq", "Questions fréquentes", "/faq");
}

type FaqGroup = { slug: string; name: string; items: { id: string; question: string; answer: string }[] };

export default async function FaqPage() {
  const [page, groups] = await Promise.all([getPage("faq"), safe(publicGet<FaqGroup[]>("/public/faq"), [])]);
  const all = groups.flatMap((g) => g.items);
  const listing = groups.length ? (
    <section className="bg-surface py-16 lg:py-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: all.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer.replace(/<[^>]+>/g, "") } })),
        }}
      />
      <div className="container-page grid gap-10 lg:grid-cols-4">
        <nav aria-label="Catégories" className="hidden lg:block">
          <ul className="sticky top-28 space-y-1">
            {groups.map((g) => (
              <li key={g.slug}>
                <a href={`#${g.slug}`} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-white">
                  {g.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-10 lg:col-span-3">
          {groups.map((g) => (
            <div key={g.slug} id={g.slug}>
              <h2 className="mb-4 text-2xl font-bold text-brand-800">{g.name}</h2>
              <FaqList items={g.items} />
            </div>
          ))}
        </div>
      </div>
    </section>
  ) : (
    <EmptyPublicState title="Aucune question publiée" />
  );
  if (!page)
    return (
      <>
        <PageHeader title="Questions fréquentes" crumbs={[{ name: "Accueil", path: "/" }, { name: "FAQ", path: "/faq" }]} />
        {listing}
      </>
    );
  return <CmsPageView page={withoutBlocks(page, ["faq"])} after={listing} />;
}
