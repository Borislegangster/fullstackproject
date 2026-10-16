import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogCards } from "@/components/site/blocks";
import { MediaImage } from "@/components/site/media";
import { Breadcrumbs } from "@/components/site/page-view";
import { safe } from "@/lib/cms";
import type { BlogCard, Media } from "@/lib/cms-types";
import { buildMetadata, getSite, JsonLd } from "@/lib/seo";
import { publicGet, publicGetOrNull, siteUrl } from "@/lib/server-api";

interface Author {
  slug: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  linkedin_url?: string | null;
  photo?: Media | null;
}

async function load(slug: string) {
  try {
    return await publicGetOrNull<Author>(`/public/blog/authors/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [site, a] = await Promise.all([getSite(), load(slug)]);
  if (!a) return { title: "Auteur introuvable", robots: { index: false } };
  return buildMetadata({ site, title: a.name, description: a.title ?? a.bio, path: `/blog/auteur/${a.slug}`, image: a.photo });
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) notFound();
  const posts = await safe(publicGet<{ items: BlogCard[] }>("/public/blog/posts", { author: a.slug, page_size: 24 }), { items: [] });
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Person", name: a.name, jobTitle: a.title, url: siteUrl(`/blog/auteur/${a.slug}`), sameAs: a.linkedin_url ? [a.linkedin_url] : undefined }} />
      <header className="bg-gradient-to-br from-brand-50 via-white to-accent-50/60">
        <div className="container-page py-12">
          <Breadcrumbs items={[{ name: "Accueil", path: "/" }, { name: "Blog", path: "/blog" }, { name: a.name, path: `/blog/auteur/${a.slug}` }]} />
          <div className="mt-6 flex items-center gap-5">
            {a.photo ? <MediaImage media={a.photo} className="h-24 w-24 rounded-full" sizes="96px" priority /> : null}
            <div>
              <h1 className="text-3xl font-extrabold text-brand-800 sm:text-4xl">{a.name}</h1>
              {a.title ? <p className="text-muted">{a.title}</p> : null}
            </div>
          </div>
          {a.bio ? <p className="mt-5 max-w-3xl text-ink">{a.bio}</p> : null}
        </div>
      </header>
      <section className="bg-surface py-16 lg:py-24">
        <div className="container-page">{posts.items.length ? <BlogCards items={posts.items} /> : <p className="text-muted">Aucun article publié.</p>}</div>
      </section>
    </>
  );
}
