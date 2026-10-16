import { ArrowRight, Target } from "lucide-react";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Blocks, FaqList, OfferCards, TestimonialCards } from "@/components/site/blocks";
import { DynIcon } from "@/components/site/icon";
import { MediaImage } from "@/components/site/media";
import { Breadcrumbs } from "@/components/site/page-view";
import { safe } from "@/lib/cms";
import type { Block, Media, OfferPayload, Seo, Testimonial } from "@/lib/cms-types";
import { buildMetadata, getSite, JsonLd } from "@/lib/seo";
import { publicGet, publicGetOrNull, siteUrl } from "@/lib/server-api";
import { previewDetail } from "@/lib/preview";

interface UniverseDetail {
  id: string;
  key: string;
  slug: string;
  name: string;
  tagline?: string | null;
  promise?: string | null;
  target?: string | null;
  icon?: string | null;
  accent?: string | null;
  hero?: Media | null;
  description?: string | null;
  prospect_wants?: string | null;
  funnel?: string[] | null;
  body_blocks?: Block[];
  offers: OfferPayload[];
  seo?: Seo | null;
}

async function load(slug: string) {
  const draft = await previewDetail<UniverseDetail>("universes", slug);
  if (draft) return draft;
  try {
    return await publicGetOrNull<UniverseDetail>(`/public/universes/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ universe: string }> }): Promise<Metadata> {
  const { universe } = await params;
  const [site, u] = await Promise.all([getSite(), load(universe)]);
  if (!u) return { title: "Offre introuvable", robots: { index: false } };
  return buildMetadata({ site, seo: u.seo, title: u.name, description: u.tagline ?? u.promise, path: `/offres/${u.slug}`, image: u.hero });
}

export default async function UniversePage({ params }: { params: Promise<{ universe: string }> }) {
  const { universe } = await params;
  const u = await load(universe);
  if (!u) notFound();
  const [faq, testimonials] = await Promise.all([
    safe(publicGet<{ slug: string; name: string; items: { id: string; question: string; answer: string }[] }[]>("/public/faq", { universe: u.key }), []),
    safe(publicGet<Testimonial[]>("/public/testimonials", { universe: u.key }), []),
  ]);
  const faqItems = faq.flatMap((c) => c.items).slice(0, 8);
  const describeHref = `/decrire-mon-projet?univers=${u.key}`;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: u.name,
          description: u.promise ?? u.tagline,
          provider: { "@type": "Organization", name: "GLOBUS ENGINEERING" },
          url: siteUrl(`/offres/${u.slug}`),
          areaServed: "CM",
        }}
      />
      <header data-hero="dark" className="noise relative isolate -mt-16 flex min-h-[92svh] items-center overflow-hidden bg-night text-white lg:-mt-20">
        {u.hero ? (
          <div className="ken-burns absolute inset-0 -z-20">
            <MediaImage media={u.hero} className="h-full w-full" priority sizes="100vw" />
          </div>
        ) : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night-950/95 via-night-900/75 to-night-900/20" />
        <div className="absolute inset-0 -z-10 bg-blueprint opacity-30 mask-radial" />
        <div className="aurora-blob -bottom-32 -right-20 -z-10 h-[28rem] w-[28rem] opacity-60" style={{ background: u.accent ?? "var(--color-accent-500)" }} />
        <div className="container-page relative py-32">
          <Breadcrumbs items={[{ name: "Accueil", path: "/" }, { name: "Offres", path: "/offres" }, { name: u.name, path: `/offres/${u.slug}` }]} dark />
          <span className="fade-up mt-10 inline-flex rounded-2xl p-3.5 shadow-2xl ring-1 ring-white/25" style={{ backgroundColor: u.accent ?? "var(--color-accent-500)" }}>
            <DynIcon name={u.icon} className="h-7 w-7 text-white" />
          </span>
          <h1 className="fade-up mt-5 max-w-3xl font-title text-5xl font-bold leading-[1.02] text-white sm:text-7xl" style={{ "--delay": "100ms" } as CSSProperties}>
            {u.name}
          </h1>
          {u.tagline ? (
            <p className="fade-up text-gradient-light mt-5 max-w-2xl font-title text-2xl font-semibold sm:text-3xl" style={{ "--delay": "200ms" } as CSSProperties}>
              {u.tagline}
            </p>
          ) : null}
          {u.promise ? (
            <p className="fade-up mt-5 max-w-2xl text-lg leading-relaxed text-brand-50" style={{ "--delay": "300ms" } as CSSProperties}>
              {u.promise}
            </p>
          ) : null}
          <div className="fade-up mt-10 flex flex-wrap gap-3" style={{ "--delay": "420ms" } as CSSProperties}>
            <Link href={describeHref} className="btn-glow group" data-track={`universe:${u.key}`}>
              Décrire mon projet <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <a href="#offres" className="btn-glass">
              Voir les offres
            </a>
          </div>
        </div>
      </header>

      <section className="bg-white py-16 lg:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {u.description ? <p className="text-xl leading-relaxed text-ink">{u.description}</p> : null}
            {u.body_blocks?.length ? (
              <div className="mt-10">
                <Blocks blocks={u.body_blocks} />
              </div>
            ) : null}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            {u.target ? (
              <div className="relative overflow-hidden rounded-[1.75rem] bg-night p-6 text-white shadow-xl">
                <div className="absolute inset-0 bg-blueprint opacity-30" />
                <p className="relative flex items-center gap-2 text-sm font-semibold text-accent-300">
                  <Target className="h-4 w-4" /> Pour qui ?
                </p>
                <p className="relative mt-2 text-sm text-brand-50">{u.target}</p>
              </div>
            ) : null}
            {u.prospect_wants ? (
              <div className="rounded-[1.75rem] bg-gradient-to-br from-accent-50 to-white p-6 ring-1 ring-accent-100">
                <p className="text-sm font-semibold text-accent-700">Ce qui compte pour vous</p>
                <p className="mt-2 text-sm text-ink">{u.prospect_wants}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {u.funnel?.length ? (
        <section className="relative isolate overflow-hidden bg-night py-20 text-white lg:py-28">
          <div className="absolute inset-0 -z-10 bg-blueprint opacity-30 mask-radial" />
          <div className="aurora-blob -left-24 top-0 -z-10 h-96 w-96 bg-brand-500/35" />
          <div className="container-page">
            <p className="eyebrow justify-center text-center text-accent-300">Étape par étape</p>
            <h2 className="mt-3 text-center font-title text-3xl font-bold text-white sm:text-5xl">
              Votre <span className="text-gradient-light">parcours</span>
            </h2>
            <ol className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <span className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-accent-400/60 to-transparent xl:block" aria-hidden="true" />
              {u.funnel.map((step, i) => (
                <li key={step} className="glass-dark relative rounded-3xl p-5 transition hover:-translate-y-1 hover:bg-white/10">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 font-title text-sm font-bold text-white shadow-lg shadow-accent-500/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-4 font-medium text-white">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <section id="offres" className="bg-surface py-20 lg:py-28">
        <div className="container-page">
          <p className="eyebrow text-accent-600">{u.name}</p>
          <h2 className="mb-10 mt-3 font-title text-3xl font-bold text-brand-900 sm:text-5xl">
            Nos <span className="text-gradient">offres</span>
          </h2>
          {u.offers.length ? <OfferCards items={u.offers} /> : <p className="text-muted">Les offres de cet univers seront bientôt publiées.</p>}
        </div>
      </section>

      {testimonials.length ? (
        <section className="bg-white py-20 lg:py-28">
          <div className="container-page">
            <h2 className="mb-12 text-center font-title text-3xl font-bold text-brand-900 sm:text-5xl">
              Ils nous ont fait <span className="text-gradient">confiance</span>
            </h2>
            <TestimonialCards items={testimonials.slice(0, 9)} layout={testimonials.length > 3 ? "carousel" : "grid"} />
          </div>
        </section>
      ) : null}

      {faqItems.length ? (
        <section className="bg-surface py-20 lg:py-28">
          <div className="container-page max-w-3xl">
            <h2 className="mb-10 text-center font-title text-3xl font-bold text-brand-900 sm:text-5xl">
              Questions <span className="text-gradient">fréquentes</span>
            </h2>
            <FaqList items={faqItems} />
          </div>
        </section>
      ) : null}

      <section className="relative isolate overflow-hidden bg-night py-20 text-white lg:py-28">
        {u.hero ? (
          <div className="absolute inset-0 -z-20 opacity-30">
            <MediaImage media={u.hero} className="h-full w-full" sizes="100vw" />
          </div>
        ) : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-700/90 via-night-900/90 to-night-950" />
        <div className="aurora-blob -right-24 -top-24 -z-10 h-96 w-96 bg-accent-500/30" />
        <div className="container-page text-center">
          <p className="mx-auto max-w-3xl font-title text-3xl font-bold text-white sm:text-5xl">
            <span className="text-gradient-light">{u.tagline ?? u.name}</span>
          </p>
          {u.promise ? <p className="mx-auto mt-5 max-w-2xl text-lg text-brand-100">{u.promise}</p> : null}
          <Link href={describeHref} className="btn-glow group mt-10">
            Décrire mon projet <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </>
  );
}
