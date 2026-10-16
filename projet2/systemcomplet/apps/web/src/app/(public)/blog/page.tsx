import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BlogCards } from "@/components/site/blocks";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { CmsPageView, PageHeader } from "@/components/site/page-view";
import { Pager } from "@/components/site/pager";
import { UrlFilters } from "@/components/site/url-filters";
import { getPage, listingMetadata, safe, withoutBlocks } from "@/lib/cms";
import type { BlogCard } from "@/lib/cms-types";
import { publicGet } from "@/lib/server-api";

type SP = Promise<Record<string, string | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const meta = await listingMetadata("blog", "Blog", "/blog");
  if (sp.q || sp.tag) return { ...meta, robots: { index: false, follow: true } };
  return meta;
}

export default async function BlogPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const [cms, categories, data] = await Promise.all([
    getPage("blog"),
    safe(publicGet<{ slug: string; name: string; count: number }[]>("/public/blog/categories"), []),
    safe(publicGet<{ items: BlogCard[]; total: number; page: number; pages: number }>("/public/blog/posts", { page, page_size: 12, category: sp.categorie, tag: sp.tag, q: sp.q }), {
      items: [],
      total: 0,
      page: 1,
      pages: 0,
    }),
  ]);
  const listing = (
    <section className="bg-surface py-16 lg:py-24">
      <div className="container-page">
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/blog" className={clsx("rounded-full px-4 py-1.5 text-sm font-medium", !sp.categorie ? "bg-brand-500 text-white" : "bg-white text-ink ring-1 ring-line hover:bg-brand-50")}>
            Tous les articles
          </Link>
          {categories
            .filter((c) => c.count > 0)
            .map((c) => (
              <Link
                key={c.slug}
                href={`/blog?categorie=${c.slug}`}
                className={clsx("rounded-full px-4 py-1.5 text-sm font-medium", sp.categorie === c.slug ? "bg-brand-500 text-white" : "bg-white text-ink ring-1 ring-line hover:bg-brand-50")}
              >
                {c.name} <span className="opacity-70">({c.count})</span>
              </Link>
            ))}
        </div>
        <div className="mb-8">
          <Suspense>
            <UrlFilters filters={[]} placeholder="Rechercher un article" />
          </Suspense>
        </div>
        {data.items.length ? (
          <>
            <BlogCards items={data.items} />
            <Pager page={data.page} pages={data.pages} basePath="/blog" params={sp} />
          </>
        ) : (
          <p className="rounded-2xl bg-white p-10 text-center text-muted ring-1 ring-line">Aucun article publié pour le moment.</p>
        )}
        <div className="mx-auto mt-14 max-w-xl rounded-2xl bg-white p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
          <p className="font-title text-lg font-semibold text-brand-800">Recevoir les nouveaux articles</p>
          <div className="mt-4 text-left">
            <NewsletterForm source="blog" />
          </div>
        </div>
      </div>
    </section>
  );
  if (!cms)
    return (
      <>
        <PageHeader title="Blog" crumbs={[{ name: "Accueil", path: "/" }, { name: "Blog", path: "/blog" }]} />
        {listing}
      </>
    );
  return <CmsPageView page={withoutBlocks(cms, ["blog"])} after={listing} />;
}
