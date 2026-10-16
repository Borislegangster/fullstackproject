import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Blocks } from "@/components/site/blocks";
import { HelpFeedback } from "@/components/site/help-feedback";
import { PageHeader } from "@/components/site/page-view";
import type { Block, Seo } from "@/lib/cms-types";
import { buildMetadata, getSite } from "@/lib/seo";
import { publicGetOrNull } from "@/lib/server-api";
import { previewDetail } from "@/lib/preview";

interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  body_blocks: Block[];
  seo?: Seo | null;
}

async function load(slug: string) {
  const draft = await previewDetail<HelpArticle>("help_articles", slug);
  if (draft) return draft;
  try {
    return await publicGetOrNull<HelpArticle>(`/public/help/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [site, a] = await Promise.all([getSite(), load(slug)]);
  if (!a) return { title: "Article introuvable", robots: { index: false } };
  return buildMetadata({ site, seo: a.seo, title: a.title, description: a.summary, path: `/aide/${a.slug}` });
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) notFound();
  return (
    <>
      <PageHeader
        title={a.seo?.h1 || a.title}
        summary={a.summary}
        crumbs={[
          { name: "Accueil", path: "/" },
          { name: "Aide", path: "/aide" },
          { name: a.title, path: `/aide/${a.slug}` },
        ]}
      />
      <section className="bg-white py-16 lg:py-24">
        <div className="container-page max-w-3xl">
          <Blocks blocks={a.body_blocks} />
          <div className="mt-12">
            <HelpFeedback slug={a.slug} />
          </div>
        </div>
      </section>
    </>
  );
}
