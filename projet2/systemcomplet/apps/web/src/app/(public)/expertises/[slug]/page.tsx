import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Blocks } from "@/components/site/blocks";
import { PageHeader } from "@/components/site/page-view";
import { optionLabel } from "@/lib/labels";
import type { Block, Media, Seo } from "@/lib/cms-types";
import { buildMetadata, getSite, JsonLd } from "@/lib/seo";
import { publicGetOrNull, siteUrl } from "@/lib/server-api";
import { previewDetail } from "@/lib/preview";

interface Expertise {
  id: string;
  slug: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  discipline?: string | null;
  icon?: string | null;
  media?: Media | null;
  body_blocks?: Block[];
  seo?: Seo | null;
}

async function load(slug: string) {
  const draft = await previewDetail<Expertise>("expertises", slug);
  if (draft) return draft;
  try {
    return await publicGetOrNull<Expertise>(`/public/expertises/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [site, e] = await Promise.all([getSite(), load(slug)]);
  if (!e) return { title: "Expertise introuvable", robots: { index: false } };
  return buildMetadata({ site, seo: e.seo, title: e.name, description: e.summary, path: `/expertises/${e.slug}`, image: e.media });
}

export default async function ExpertisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await load(slug);
  if (!e) notFound();
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", name: e.name, description: e.summary, url: siteUrl(`/expertises/${e.slug}`), provider: { "@type": "Organization", name: "GLOBUS ENGINEERING" } }} />
      <PageHeader
        eyebrow={e.discipline ? optionLabel(e.discipline) : null}
        title={e.seo?.h1 || e.name}
        summary={e.summary}
        media={e.media}
        crumbs={[
          { name: "Accueil", path: "/" },
          { name: "Expertises", path: "/expertises" },
          { name: e.name, path: `/expertises/${e.slug}` },
        ]}
      />
      <section className="bg-white py-16 lg:py-24">
        <div className="container-page max-w-4xl space-y-12">
          {e.description ? <p className="text-xl leading-relaxed text-ink">{e.description}</p> : null}
          {e.body_blocks?.length ? <Blocks blocks={e.body_blocks} /> : null}
          <div className="relative overflow-hidden rounded-[2rem] bg-night px-6 py-12 text-center text-white shadow-2xl">
            <div className="absolute inset-0 bg-blueprint opacity-30 mask-radial" />
            <div className="aurora-blob -left-16 -top-16 h-56 w-56 bg-brand-500/50" />
            <div className="aurora-blob -bottom-16 -right-10 h-56 w-56 bg-accent-500/40" />
            <Link href="/decrire-mon-projet" className="btn-glow group relative" data-track={`expertise:${e.slug}`}>
              Décrire mon projet <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
