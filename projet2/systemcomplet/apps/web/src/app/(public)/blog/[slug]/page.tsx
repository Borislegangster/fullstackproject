import { Clock, Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogCards, Blocks } from "@/components/site/blocks";
import { BlogViewTracker, Comments, LikeButton, ShareButtons } from "@/components/site/blog-interactions";
import { MediaImage } from "@/components/site/media";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { Breadcrumbs } from "@/components/site/page-view";
import type { Block, BlogCard, Seo } from "@/lib/cms-types";
import { dateLong } from "@/lib/format";
import { buildMetadata, getSite, JsonLd } from "@/lib/seo";
import { publicGetOrNull, siteUrl } from "@/lib/server-api";
import { previewDetail } from "@/lib/preview";

interface PostDetail extends BlogCard {
  body_blocks: Block[];
  allow_comments: boolean;
  share_count: number;
  comments: any[];
  seo?: Seo | null;
  related: BlogCard[];
}

async function load(slug: string) {
  const draft = await previewDetail<PostDetail>("blog_posts", slug);
  if (draft) return draft;
  try {
    return await publicGetOrNull<PostDetail>(`/public/blog/posts/${encodeURIComponent(slug)}`, undefined, { fresh: true });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [site, p] = await Promise.all([getSite(), load(slug)]);
  if (!p) return { title: "Article introuvable", robots: { index: false } };
  return buildMetadata({ site, seo: p.seo, title: p.title, description: p.excerpt, path: p.path, image: p.cover, type: "article", publishedTime: p.published_at });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  const url = siteUrl(p.path);
  const renderedAt = Math.floor(Date.now() / 1000);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: p.title,
          description: p.excerpt,
          image: p.cover?.url ? siteUrl(p.cover.url) : undefined,
          datePublished: p.published_at,
          author: p.author ? { "@type": "Person", name: p.author.name } : { "@type": "Organization", name: "GLOBUS ENGINEERING" },
          publisher: { "@type": "Organization", name: "GLOBUS ENGINEERING", logo: { "@type": "ImageObject", url: siteUrl("/brand/logo-globus.png") } },
          mainEntityOfPage: url,
          interactionStatistic: [
            { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: p.like_count ?? 0 },
            { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: p.comment_count ?? 0 },
          ],
        }}
      />
      <BlogViewTracker slug={p.slug} postId={p.id} />
      <article>
        <header data-hero="dark" className="noise relative isolate -mt-16 overflow-hidden bg-night pb-28 pt-32 text-white lg:-mt-20 lg:pb-36 lg:pt-44">
          {p.cover ? (
            <>
              <div className="ken-burns absolute inset-0 -z-20">
                <MediaImage media={p.cover} className="h-full w-full" priority sizes="100vw" />
              </div>
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-night-950/85 via-night-950/75 to-night-950/95" />
            </>
          ) : (
            <div className="aurora-blob -left-24 -top-24 -z-10 h-96 w-96 bg-brand-500/40" />
          )}
          <div className="absolute inset-0 -z-10 bg-blueprint opacity-30 mask-radial" />
          <div className="container-page max-w-4xl">
            <Breadcrumbs items={[{ name: "Accueil", path: "/" }, { name: "Blog", path: "/blog" }, { name: p.title, path: p.path }]} dark />
            {p.category ? (
              <Link href={`/blog?categorie=${p.category.slug}`} className="mt-8 inline-flex rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-lg">
                {p.category.name}
              </Link>
            ) : null}
            <h1 className="fade-up mt-5 font-title text-4xl font-bold leading-[1.08] text-white sm:text-6xl">{p.seo?.h1 || p.title}</h1>
            {p.excerpt ? <p className="fade-up mt-5 text-lg text-brand-100">{p.excerpt}</p> : null}
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand-100">
              {p.author ? (
                <Link href={`/blog/auteur/${p.author.slug}`} className="flex items-center gap-2 font-semibold text-white hover:text-accent-300">
                  {p.author.photo ? (
                    <span className="rounded-full bg-gradient-to-br from-accent-400 to-brand-500 p-[2px]">
                      <MediaImage media={p.author.photo} className="h-9 w-9 rounded-full" sizes="36px" />
                    </span>
                  ) : null}
                  {p.author.name}
                </Link>
              ) : null}
              {p.published_at ? <time dateTime={p.published_at}>{dateLong(p.published_at)}</time> : null}
              {p.reading_minutes ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-accent-400" /> {p.reading_minutes} min
                </span>
              ) : null}
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4 text-accent-400" /> {p.view_count ?? 0}
              </span>
            </div>
          </div>
        </header>
        {p.cover ? (
          <div className="container-page relative z-10 -mt-20 max-w-5xl lg:-mt-24">
            <MediaImage media={p.cover} className="aspect-[16/8] w-full rounded-[2rem] shadow-2xl ring-4 ring-white" priority sizes="(min-width: 1024px) 1024px, 100vw" />
          </div>
        ) : null}
        <div className="container-page max-w-3xl py-10">
          <Blocks blocks={p.body_blocks} />
          {p.tags?.length ? (
            <div className="mt-10 flex flex-wrap gap-2">
              {p.tags.map((t) => (
                <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700 hover:bg-brand-100">
                  #{t}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-y border-line py-5">
            <LikeButton slug={p.slug} initial={p.like_count ?? 0} />
            <ShareButtons slug={p.slug} title={p.title} url={url} initial={p.share_count ?? 0} />
          </div>
          {p.author?.bio ? (
            <div className="mt-10 flex gap-4 rounded-2xl bg-surface p-5">
              {p.author.photo ? <MediaImage media={p.author.photo} className="h-16 w-16 shrink-0 rounded-full" sizes="64px" /> : null}
              <div>
                <p className="font-semibold text-brand-800">{p.author.name}</p>
                {p.author.title ? <p className="text-sm text-muted">{p.author.title}</p> : null}
                <p className="mt-2 text-sm text-ink">{p.author.bio}</p>
              </div>
            </div>
          ) : null}
          <div className="mt-12">
            <Comments slug={p.slug} comments={p.comments} allow={p.allow_comments} renderedAt={renderedAt} />
          </div>
          <div className="relative mt-12 overflow-hidden rounded-[1.75rem] bg-night p-7 text-white shadow-xl">
            <div className="absolute inset-0 bg-blueprint opacity-30" />
            <p className="relative font-title text-xl font-bold">Recevoir nos prochains articles</p>
            <div className="relative mt-4">
              <NewsletterForm source="blog_article" dark />
            </div>
          </div>
        </div>
      </article>
      {p.related.length ? (
        <section className="bg-surface py-16 lg:py-24">
          <div className="container-page">
            <h2 className="mb-10 font-title text-3xl font-bold text-brand-900">
              À lire <span className="text-gradient">aussi</span>
            </h2>
            <BlogCards items={p.related} />
          </div>
        </section>
      ) : null}
    </>
  );
}
