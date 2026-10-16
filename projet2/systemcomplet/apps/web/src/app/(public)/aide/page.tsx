import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DynIcon } from "@/components/site/icon";
import { CmsPageView, EmptyPublicState, PageHeader } from "@/components/site/page-view";
import { getPage, listingMetadata, safe } from "@/lib/cms";
import { publicGet } from "@/lib/server-api";

export function generateMetadata(): Promise<Metadata> {
  return listingMetadata("help", "Centre d'aide", "/aide");
}

type HelpGroup = { slug: string; name: string; description?: string | null; icon?: string | null; articles: { slug: string; title: string; summary?: string | null; path: string }[] };

export default async function HelpCenterPage() {
  const [page, groups] = await Promise.all([getPage("help"), safe(publicGet<HelpGroup[]>("/public/help", { audience: "client" }), [])]);
  const listing = groups.length ? (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.slug} className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line">
            <span className="inline-flex rounded-xl bg-brand-50 p-3 text-brand-600">
              <DynIcon name={g.icon ?? "help"} />
            </span>
            <h2 className="mt-4 text-xl font-bold text-brand-800">{g.name}</h2>
            {g.description ? <p className="mt-1 text-sm text-muted">{g.description}</p> : null}
            <ul className="mt-4 space-y-2">
              {g.articles.map((a) => (
                <li key={a.slug}>
                  <Link href={a.path} className="group flex items-start justify-between gap-2 text-sm text-ink hover:text-brand-600">
                    {a.title}
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  ) : (
    <EmptyPublicState title="Aucun article d'aide publié" />
  );
  if (!page)
    return (
      <>
        <PageHeader title="Centre d'aide" crumbs={[{ name: "Accueil", path: "/" }, { name: "Aide", path: "/aide" }]} />
        {listing}
      </>
    );
  return <CmsPageView page={page} after={listing} />;
}
