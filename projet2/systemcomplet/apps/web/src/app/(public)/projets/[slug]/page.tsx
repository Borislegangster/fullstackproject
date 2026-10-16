import { ArrowRight, Calendar, Clock, MapPin, Ruler } from "lucide-react";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Blocks, ProjectCards, TestimonialCards } from "@/components/site/blocks";
import { BeforeAfterSlider } from "@/components/site/before-after";
import { GalleryCarousel } from "@/components/site/gallery-carousel";
import { MediaImage, MediaVideo } from "@/components/site/media";
import { ModelViewer } from "@/components/site/model-viewer";
import { Breadcrumbs } from "@/components/site/page-view";
import type { Block, Media, ProjectCard, Seo, Testimonial } from "@/lib/cms-types";
import { number } from "@/lib/format";
import { optionLabel } from "@/lib/labels";
import { buildMetadata, getSite, JsonLd } from "@/lib/seo";
import { publicGetOrNull, siteUrl } from "@/lib/server-api";
import { previewDetail } from "@/lib/preview";

interface ProjectDetail {
  id: string;
  slug: string;
  title: string;
  universe?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  year?: number | null;
  surface_m2?: string | null;
  duration_months?: number | null;
  budget_range?: string | null;
  client_type?: string | null;
  delivery_status?: string | null;
  summary?: string | null;
  challenge?: string | null;
  solution?: string | null;
  results?: ({ label: string; value: string } | string)[] | null;
  cover_media?: Media | null;
  gallery_medias?: Media[];
  video_medias?: Media[];
  model_media?: Media | null;
  before_after: { before?: Media | null; after?: Media | null; caption?: string | null }[];
  body_blocks?: Block[];
  testimonial?: Testimonial;
  related: ProjectCard[];
  seo?: Seo | null;
  published_at?: string | null;
}

async function load(slug: string) {
  const draft = await previewDetail<ProjectDetail>("projects", slug);
  if (draft) return draft;
  try {
    return await publicGetOrNull<ProjectDetail>(`/public/projects/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [site, p] = await Promise.all([getSite(), load(slug)]);
  if (!p) return { title: "Réalisation introuvable", robots: { index: false } };
  return buildMetadata({ site, seo: p.seo, title: p.title, description: p.summary, path: `/projets/${p.slug}`, image: p.cover_media });
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  const facts = [
    p.city ? { icon: <MapPin className="h-4 w-4" />, label: "Lieu", value: [p.city, p.country].filter(Boolean).join(", ") } : null,
    p.year ? { icon: <Calendar className="h-4 w-4" />, label: "Année", value: String(p.year) } : null,
    p.surface_m2 ? { icon: <Ruler className="h-4 w-4" />, label: "Surface", value: `${number(p.surface_m2)} m²` } : null,
    p.duration_months ? { icon: <Clock className="h-4 w-4" />, label: "Durée", value: `${p.duration_months} mois` } : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: p.title,
          description: p.summary,
          url: siteUrl(`/projets/${p.slug}`),
          image: p.cover_media?.url ? siteUrl(p.cover_media.url) : undefined,
          locationCreated: p.city ? { "@type": "Place", name: [p.city, p.country].filter(Boolean).join(", ") } : undefined,
          dateCreated: p.year ? String(p.year) : undefined,
          creator: { "@type": "Organization", name: "GLOBUS ENGINEERING" },
        }}
      />
      <header data-hero="dark" className="noise relative isolate -mt-16 flex min-h-[88svh] items-end overflow-hidden bg-night text-white lg:-mt-20">
        {p.cover_media ? (
          <div className="ken-burns absolute inset-0 -z-20">
            <MediaImage media={p.cover_media} className="h-full w-full" priority sizes="100vw" />
          </div>
        ) : (
          <div className="absolute inset-0 -z-20 bg-blueprint opacity-50" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night-950 via-night-950/55 to-night-950/20" />
        <div className="container-page relative w-full pb-12 pt-36">
          <Breadcrumbs items={[{ name: "Accueil", path: "/" }, { name: "Réalisations", path: "/projets" }, { name: p.title, path: `/projets/${p.slug}` }]} dark />
          <div className="fade-up mt-6 flex flex-wrap gap-2 text-xs">
            {p.universe ? <span className="rounded-full bg-accent-500 px-3 py-1 font-semibold text-white shadow-lg">{optionLabel(p.universe)}</span> : null}
            {p.category ? <span className="glass-dark rounded-full px-3 py-1 font-semibold text-white">{p.category}</span> : null}
            {p.delivery_status ? <span className="glass-dark rounded-full px-3 py-1 font-semibold text-white">{optionLabel(p.delivery_status)}</span> : null}
          </div>
          <h1 className="fade-up mt-4 max-w-4xl font-title text-4xl font-bold leading-[1.05] text-white sm:text-6xl" style={{ "--delay": "100ms" } as CSSProperties}>
            {p.seo?.h1 || p.title}
          </h1>
          {p.summary ? (
            <p className="fade-up mt-5 max-w-3xl text-lg text-brand-100" style={{ "--delay": "200ms" } as CSSProperties}>
              {p.summary}
            </p>
          ) : null}
          {facts.length ? (
            <dl className="fade-up mt-10 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4" style={{ "--delay": "320ms" } as CSSProperties}>
              {facts.map((f) => (
                <div key={f.label} className="glass-dark rounded-2xl px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-200">
                    <span className="text-accent-400">{f.icon}</span> {f.label}
                  </dt>
                  <dd className="mt-1 font-title text-lg font-bold text-white">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </header>

      <section className="bg-white py-16 lg:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-3">
          <div className="space-y-14 lg:col-span-2">
            {p.challenge || p.solution ? (
              <div className="grid gap-5 md:grid-cols-2">
                {p.challenge ? (
                  <div className="rounded-[1.75rem] bg-surface p-7 ring-1 ring-line">
                    <p className="eyebrow text-accent-600">Le défi</p>
                    <p className="mt-4 leading-relaxed text-ink">{p.challenge}</p>
                  </div>
                ) : null}
                {p.solution ? (
                  <div className="relative overflow-hidden rounded-[1.75rem] bg-night p-7 text-white shadow-xl">
                    <div className="absolute inset-0 bg-blueprint opacity-30" />
                    <p className="eyebrow relative text-accent-300">Notre réponse</p>
                    <p className="relative mt-4 leading-relaxed text-brand-50">{p.solution}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {p.gallery_medias?.length ? <GalleryCarousel medias={p.gallery_medias} /> : null}
            {p.before_after.filter((x) => x.before && x.after).length ? (
              <div>
                <h2 className="mb-6 font-title text-3xl font-bold text-brand-900">
                  Avant / <span className="text-gradient">après</span>
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {p.before_after.map((x, i) => (x.before && x.after ? <BeforeAfterSlider key={i} before={x.before} after={x.after} caption={x.caption} /> : null))}
                </div>
              </div>
            ) : null}
            {p.video_medias?.length ? (
              <div className="space-y-6">
                {p.video_medias.map((v) => (
                  <div key={v.id} className="rounded-[2rem] bg-gradient-to-br from-brand-400/70 via-accent-400/50 to-brand-700/70 p-[2px] shadow-2xl">
                    <div className="overflow-hidden rounded-[calc(2rem-2px)] bg-night">
                      <MediaVideo media={v} className="rounded-none" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {p.model_media?.url ? (
              <div>
                <h2 className="mb-6 font-title text-3xl font-bold text-brand-900">
                  Maquette <span className="text-gradient">3D</span>
                </h2>
                <div className="relative overflow-hidden rounded-[2rem] bg-night shadow-2xl">
                  <div className="absolute inset-0 bg-blueprint opacity-40" />
                  <ModelViewer url={p.model_media.url} className="relative h-[480px]" />
                </div>
              </div>
            ) : null}
            {p.body_blocks?.length ? <Blocks blocks={p.body_blocks} /> : null}
          </div>
          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            {p.results?.length ? (
              <div className="relative overflow-hidden rounded-[1.75rem] bg-night p-7 text-white shadow-xl">
                <div className="aurora-blob -right-16 -top-16 h-48 w-48 bg-accent-500/40" />
                <p className="eyebrow relative text-accent-300">Résultats</p>
                <ul className="relative mt-5 space-y-4">
                  {p.results.map((r, i) =>
                    typeof r === "string" ? (
                      <li key={i} className="text-sm text-brand-50">
                        {r}
                      </li>
                    ) : (
                      <li key={i} className="border-b border-white/10 pb-3 last:border-0">
                        <p className="text-xs uppercase tracking-wide text-brand-200">{r.label}</p>
                        <p className="text-gradient-light font-title text-2xl font-bold">{r.value}</p>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}
            {p.testimonial ? <TestimonialCards items={[p.testimonial]} /> : null}
            <Link href={`/decrire-mon-projet${p.universe ? `?univers=${p.universe}` : ""}`} className="btn-glow group w-full" data-track={`project:${p.slug}`}>
              Un projet similaire ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </aside>
        </div>
      </section>

      {p.related.length ? (
        <section className="bg-surface py-16 lg:py-24">
          <div className="container-page">
            <h2 className="mb-10 font-title text-3xl font-bold text-brand-900">
              Réalisations <span className="text-gradient">similaires</span>
            </h2>
            <ProjectCards items={p.related} />
          </div>
        </section>
      ) : null}
    </>
  );
}
