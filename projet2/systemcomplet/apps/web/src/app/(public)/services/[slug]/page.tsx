import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Blocks, FaqList, OfferCards } from "@/components/site/blocks";
import { CmsForm } from "@/components/site/cms-form";
import { PageHeader } from "@/components/site/page-view";
import { optionLabel } from "@/lib/labels";
import type { Block, Media, OfferPayload, Seo } from "@/lib/cms-types";
import { buildMetadata, getSite, JsonLd } from "@/lib/seo";
import { publicGetOrNull, siteUrl } from "@/lib/server-api";
import { previewDetail } from "@/lib/preview";

interface ServiceDetail {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
  summary?: string | null;
  deliverables?: string[] | null;
  icon?: string | null;
  media?: Media | null;
  body_blocks?: Block[];
  related_offers?: OfferPayload[];
  faq?: { id: string; question: string; answer: string }[];
  seo?: Seo | null;
}

async function load(slug: string) {
  const draft = await previewDetail<ServiceDetail>("services", slug);
  if (draft) return draft;
  try {
    return await publicGetOrNull<ServiceDetail>(`/public/services/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [site, s] = await Promise.all([getSite(), load(slug)]);
  if (!s) return { title: "Service introuvable", robots: { index: false } };
  return buildMetadata({ site, seo: s.seo, title: s.name, description: s.summary, path: `/services/${s.slug}`, image: s.media });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await load(slug);
  if (!s) notFound();
  const ld: Record<string, unknown>[] = [
    { "@context": "https://schema.org", "@type": "Service", name: s.name, description: s.summary, serviceType: s.category, url: siteUrl(`/services/${s.slug}`), provider: { "@type": "Organization", name: "GLOBUS ENGINEERING" } },
  ];
  if (s.faq?.length)
    ld.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: s.faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer.replace(/<[^>]+>/g, "") } })),
    });
  return (
    <>
      <JsonLd data={ld} />
      <PageHeader
        eyebrow={s.category ? optionLabel(s.category) : null}
        title={s.seo?.h1 || s.name}
        summary={s.summary}
        media={s.media}
        crumbs={[
          { name: "Accueil", path: "/" },
          { name: "Services", path: "/services" },
          { name: s.name, path: `/services/${s.slug}` },
        ]}
      />
      <section className="bg-white py-16 lg:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-3">
          <div className="space-y-14 lg:col-span-2">
            {s.deliverables?.length ? (
              <div>
                <p className="eyebrow text-accent-600">Ce que vous recevez</p>
                <h2 className="mt-3 font-title text-3xl font-bold text-brand-900">
                  Les <span className="text-gradient">livrables</span>
                </h2>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {s.deliverables.map((d) => (
                    <li key={d} className="card-lift flex items-start gap-3 rounded-2xl bg-surface p-4 text-ink ring-1 ring-line">
                      <span className="rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 p-1.5 text-white shadow">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <span className="pt-0.5">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {s.body_blocks?.length ? <Blocks blocks={s.body_blocks} /> : null}
            {s.related_offers?.length ? (
              <div>
                <h2 className="mb-6 font-title text-3xl font-bold text-brand-900">
                  Offres <span className="text-gradient">associées</span>
                </h2>
                <OfferCards items={s.related_offers} />
              </div>
            ) : null}
            {s.faq?.length ? (
              <div>
                <h2 className="mb-6 font-title text-3xl font-bold text-brand-900">
                  Questions <span className="text-gradient">fréquentes</span>
                </h2>
                <FaqList items={s.faq} />
              </div>
            ) : null}
          </div>
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[1.75rem] bg-gradient-to-br from-brand-400/60 via-accent-400/50 to-brand-700/60 p-[2px] shadow-2xl">
              <div className="rounded-[calc(1.75rem-2px)] bg-white p-6">
                <CmsForm formKey="contact" title="Parlons de votre besoin" context={{ service_slug: s.slug, subject: s.name }} />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
