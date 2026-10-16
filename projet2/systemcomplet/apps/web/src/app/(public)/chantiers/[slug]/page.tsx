import { CalendarDays, CheckCircle2, Circle, Clock, FileBadge2, HardHat, MapPin, Phone, Ruler, Users } from "lucide-react";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { PanelContact } from "./panel-contact";
import { Breadcrumbs } from "@/components/site/page-view";
import { dateLong, number } from "@/lib/format";
import { optionLabel } from "@/lib/labels";
import { JsonLd } from "@/lib/seo";
import { publicGetOrNull, siteUrl } from "@/lib/server-api";

interface Chantier {
  slug: string;
  title: string;
  location?: string | null;
  owner?: string | null;
  contractor: string;
  permit?: { number: string; date?: string | null; authority?: string | null } | null;
  description?: string | null;
  working_hours?: string | null;
  contact_phone?: string | null;
  project_type?: string | null;
  surface_m2?: string | null;
  levels?: number | null;
  start?: string | null;
  end_planned?: string | null;
  status: string;
  hiring?: { open: boolean; text?: string | null } | null;
  message_kinds: string[];
  updated_at: string;
  progress?: { pct: string; phases: { name: string; pct: string; status: string }[] };
  milestones?: { name: string; done: boolean; month: string }[];
  photos?: { url: string; thumb: string; caption?: string | null; taken_at?: string | null }[];
}

async function load(slug: string, qr: boolean): Promise<Chantier | null> {
  try {
    return await publicGetOrNull<Chantier>(`/public/chantiers/${encodeURIComponent(slug)}`, qr ? { src: "qr" } : undefined, { fresh: true });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await publicGetOrNull<Chantier>(`/public/chantiers/${encodeURIComponent(slug)}`, { src: "preview" }).catch(() => null);
  if (!c) return { title: "Chantier introuvable", robots: { index: false } };
  return {
    title: `${c.title} — chantier en cours`,
    description: c.description ?? `Suivez en direct le chantier « ${c.title} » réalisé par GLOBUS ENGINEERING.`,
    alternates: { canonical: siteUrl(`/chantiers/${c.slug}`) },
    openGraph: { images: c.photos?.[0] ? [siteUrl(c.photos[0].url)] : undefined },
  };
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Page publique d'un chantier, ouverte par le QR code du panneau réglementaire (I4). */
export default async function ChantierPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await load(slug, sp.src === "qr");
  if (!c) notFound();
  const cover = c.photos?.[0];
  const pct = Number(c.progress?.pct ?? 0);
  const facts = [
    c.location ? { icon: <MapPin className="h-4 w-4" />, label: "Lieu", value: c.location } : null,
    c.surface_m2 ? { icon: <Ruler className="h-4 w-4" />, label: "Surface", value: `${number(c.surface_m2)} m²${c.levels ? ` · ${c.levels} niv.` : ""}` } : null,
    c.start ? { icon: <CalendarDays className="h-4 w-4" />, label: "Démarrage", value: dateLong(c.start) } : null,
    c.end_planned ? { icon: <Clock className="h-4 w-4" />, label: "Livraison prévue", value: dateLong(c.end_planned) } : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Place",
          name: c.title,
          description: c.description ?? undefined,
          url: siteUrl(`/chantiers/${c.slug}`),
          address: c.location ?? undefined,
        }}
      />
      <header data-hero="dark" className="noise relative isolate -mt-16 flex min-h-[78svh] items-end overflow-hidden bg-night text-white lg:-mt-20">
        {cover ? (
          <div className="ken-burns absolute inset-0 -z-20">
            <img src={cover.url} alt={cover.caption ?? c.title} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="absolute inset-0 -z-20 bg-blueprint opacity-50" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night-950 via-night-950/60 to-night-950/20" />
        <div className="container-page relative w-full pb-12 pt-36">
          <Breadcrumbs items={[{ name: "Accueil", path: "/" }, { name: "Chantiers en cours", path: "/chantiers" }, { name: c.title, path: `/chantiers/${c.slug}` }]} dark />
          <div className="fade-up mt-6 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1 font-semibold text-white shadow-lg">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Chantier en direct
            </span>
            {c.project_type ? <span className="glass-dark rounded-full px-3 py-1 font-semibold text-white">{optionLabel(c.project_type)}</span> : null}
            {c.hiring?.open ? <span className="glass-dark rounded-full px-3 py-1 font-semibold text-accent-200">On recrute dans le quartier</span> : null}
          </div>
          <h1 className="fade-up mt-4 max-w-4xl font-title text-4xl font-bold leading-[1.05] text-white sm:text-6xl" style={{ "--delay": "100ms" } as CSSProperties}>
            {c.title}
          </h1>
          {c.description ? (
            <p className="fade-up mt-5 max-w-3xl text-lg text-brand-100" style={{ "--delay": "200ms" } as CSSProperties}>
              {c.description}
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
            {c.progress ? (
              <div>
                <p className="eyebrow text-accent-600">Avancement</p>
                <div className="mt-4 flex items-end gap-4">
                  <p className="text-gradient font-title text-7xl font-extrabold tabular-nums">{Math.round(pct)}%</p>
                  <p className="pb-3 text-sm text-muted">mis à jour le {dateLong(c.updated_at)}</p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                {c.progress.phases.length ? (
                  <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                    {c.progress.phases.map((ph) => (
                      <li key={ph.name} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-ink">{ph.name}</span>
                          <span className="tabular-nums text-muted">{Math.round(Number(ph.pct))} %</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, Number(ph.pct))}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {c.milestones?.length ? (
              <div>
                <p className="eyebrow text-accent-600">Étapes clés</p>
                <ol className="mt-6 space-y-0">
                  {c.milestones.map((m, i) => (
                    <li key={`${m.name}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < (c.milestones?.length ?? 0) - 1 ? <span className="absolute left-[11px] top-7 h-full w-px bg-line" aria-hidden="true" /> : null}
                      {m.done ? <CheckCircle2 className="relative h-6 w-6 shrink-0 text-emerald-600" /> : <Circle className="relative h-6 w-6 shrink-0 text-slate-300" />}
                      <div>
                        <p className={`font-semibold ${m.done ? "text-ink" : "text-muted"}`}>{m.name}</p>
                        <p className="text-xs capitalize text-muted">{m.done ? "Réalisé en " : "Prévu en "}{monthLabel(m.month)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {c.photos?.length ? (
              <div>
                <p className="eyebrow text-accent-600">Le chantier en images</p>
                <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {c.photos.map((ph, i) => (
                    <a key={ph.url} href={ph.url} target="_blank" rel="noopener noreferrer" className={`group relative overflow-hidden rounded-2xl bg-slate-100 ${i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"}`}>
                      <img src={ph.thumb} alt={ph.caption ?? `Photo du chantier ${c.title}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                      {ph.caption ? <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 px-3 py-2 text-xs text-white">{ph.caption}</span> : null}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <div className="relative overflow-hidden rounded-[1.75rem] bg-night p-7 text-white shadow-xl">
              <div className="aurora-blob -right-16 -top-16 h-48 w-48 bg-accent-500/40" />
              <p className="eyebrow relative text-accent-300">Panneau de chantier</p>
              <dl className="relative mt-5 space-y-4 text-sm">
                {c.owner ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-brand-200">Maître d&apos;ouvrage</dt>
                    <dd className="font-semibold">{c.owner}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-brand-200">
                    <HardHat className="h-3.5 w-3.5" /> Entreprise
                  </dt>
                  <dd className="font-semibold">{c.contractor}</dd>
                </div>
                {c.permit ? (
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-brand-200">
                      <FileBadge2 className="h-3.5 w-3.5" /> Permis de bâtir
                    </dt>
                    <dd className="font-semibold">
                      N° {c.permit.number}
                      {c.permit.date ? ` du ${dateLong(c.permit.date)}` : ""}
                      {c.permit.authority ? <span className="block text-xs font-normal text-brand-100">{c.permit.authority}</span> : null}
                    </dd>
                  </div>
                ) : null}
                {c.working_hours ? (
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-brand-200">
                      <Clock className="h-3.5 w-3.5" /> Horaires
                    </dt>
                    <dd className="font-semibold">{c.working_hours}</dd>
                  </div>
                ) : null}
                {c.contact_phone ? (
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-brand-200">
                      <Phone className="h-3.5 w-3.5" /> Contact chantier
                    </dt>
                    <dd>
                      <a href={`tel:${c.contact_phone}`} className="font-semibold text-accent-200 hover:underline">
                        {c.contact_phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
            {c.hiring?.open ? (
              <div className="rounded-[1.75rem] bg-gradient-to-br from-accent-500 to-accent-600 p-6 text-white shadow-xl">
                <p className="flex items-center gap-2 font-title text-xl font-bold">
                  <Users className="h-5 w-5" /> Nous recrutons
                </p>
                <p className="mt-2 text-sm text-white/90">{c.hiring.text ?? "Profils du quartier bienvenus."} Laissez votre candidature ci-dessous.</p>
              </div>
            ) : null}
            <PanelContact slug={c.slug} kinds={c.message_kinds} />
          </aside>
        </div>
      </section>
    </>
  );
}
