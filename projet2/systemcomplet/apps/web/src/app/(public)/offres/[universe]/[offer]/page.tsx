import { ArrowRight, CheckCircle2, Clock, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Blocks } from "@/components/site/blocks";
import { DynIcon } from "@/components/site/icon";
import { PageHeader } from "@/components/site/page-view";
import type { OfferPayload } from "@/lib/cms-types";
import { buildMetadata, getSite, JsonLd } from "@/lib/seo";
import { publicGetOrNull, siteUrl } from "@/lib/server-api";
import { previewDetail } from "@/lib/preview";

async function load(slug: string) {
  const draft = await previewDetail<OfferPayload>("offers", slug);
  if (draft) return draft;
  try {
    return await publicGetOrNull<OfferPayload>(`/public/offers/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ universe: string; offer: string }> }): Promise<Metadata> {
  const { offer } = await params;
  const [site, o] = await Promise.all([getSite(), load(offer)]);
  if (!o) return { title: "Offre introuvable", robots: { index: false } };
  return buildMetadata({ site, seo: o.seo, title: o.name, description: o.summary, path: o.path ?? `/offres/${o.slug}`, image: o.media });
}

export default async function OfferPage({ params }: { params: Promise<{ universe: string; offer: string }> }) {
  const { universe, offer } = await params;
  const o = await load(offer);
  if (!o || !o.universe) notFound();
  if (o.universe.slug !== universe) permanentRedirect(`/offres/${o.universe.slug}/${o.slug}`);
  const steps = (o.steps ?? []).map((s) => (typeof s === "string" ? { title: s, text: undefined } : s));
  const describeHref = `/decrire-mon-projet?univers=${o.universe.key}&offre=${o.slug}`;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: o.name,
          description: o.summary,
          serviceType: o.universe.name,
          provider: { "@type": "Organization", name: "GLOBUS ENGINEERING" },
          url: siteUrl(`/offres/${o.universe.slug}/${o.slug}`),
        }}
      />
      <PageHeader
        eyebrow={o.universe.name}
        title={o.seo?.h1 || o.name}
        summary={o.summary}
        media={o.media}
        crumbs={[
          { name: "Accueil", path: "/" },
          { name: "Offres", path: "/offres" },
          { name: o.universe.name, path: `/offres/${o.universe.slug}` },
          { name: o.name, path: `/offres/${o.universe.slug}/${o.slug}` },
        ]}
      >
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {o.price_hint ? (
            <span className="glass-dark inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-semibold text-white">
              <Wallet className="h-4 w-4 text-accent-400" /> {o.price_hint}
            </span>
          ) : null}
          {o.duration_hint ? (
            <span className="glass-dark inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-semibold text-white">
              <Clock className="h-4 w-4 text-accent-400" /> {o.duration_hint}
            </span>
          ) : null}
        </div>
      </PageHeader>
      <section className="bg-white py-16 lg:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-3">
          <div className="space-y-14 lg:col-span-2">
            {o.description ? <p className="text-xl leading-relaxed text-ink first-letter:float-left first-letter:mr-2 first-letter:font-title first-letter:text-6xl first-letter:font-bold first-letter:leading-none first-letter:text-accent-500">{o.description}</p> : null}
            {steps.length ? (
              <div>
                <p className="eyebrow text-accent-600">Votre parcours</p>
                <h2 className="mt-3 font-title text-3xl font-bold text-brand-900">
                  Les <span className="text-gradient">étapes</span>
                </h2>
                <ol className="relative mt-8">
                  <span className="absolute bottom-6 left-[1.35rem] top-6 w-px bg-gradient-to-b from-accent-500 via-brand-400 to-transparent" aria-hidden="true" />
                  {steps.map((s, i) => (
                    <li key={s.title} className="relative pb-6 pl-16 last:pb-0">
                      <span className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 font-title text-sm font-bold text-white shadow-lg shadow-accent-500/30 ring-4 ring-white">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
                        <p className="font-title font-bold text-brand-900">{s.title}</p>
                        {s.text ? <p className="mt-1 text-sm text-muted">{s.text}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {o.body_blocks?.length ? <Blocks blocks={o.body_blocks} /> : null}
          </div>
          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <div className="relative overflow-hidden rounded-[1.75rem] bg-night p-7 text-white shadow-2xl">
              <div className="absolute inset-0 bg-blueprint opacity-30" />
              <div className="aurora-blob -right-16 -top-16 h-48 w-48 bg-accent-500/40" />
              <span className="relative inline-flex rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 p-3 text-white shadow-lg">
                <DynIcon name={o.icon} />
              </span>
              {o.deliverables?.length ? (
                <>
                  <p className="relative mt-5 font-title text-lg font-bold">Ce qui est inclus</p>
                  <ul className="relative mt-3 space-y-2.5">
                    {o.deliverables.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm text-brand-50">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" /> {d}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {o.ideal_for ? (
                <div className="glass-dark relative mt-5 rounded-2xl p-4 text-sm">
                  <p className="font-semibold text-accent-300">Idéal pour</p>
                  <p className="mt-1 text-brand-50">{o.ideal_for}</p>
                </div>
              ) : null}
              <Link href={describeHref} className="btn-glow group relative mt-6 w-full" data-track={`offer:${o.slug}`}>
                {o.cta_label ?? "Décrire mon projet"} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
