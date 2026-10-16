import { ArrowRight, HardHat, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Reveal, Stagger } from "@/components/site/fx";
import { optionLabel } from "@/lib/labels";
import { publicGetSafe, siteUrl } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Chantiers en cours",
  description: "Suivez en direct les chantiers GLOBUS ENGINEERING : avancement, étapes clés et photos, mis à jour par nos équipes.",
  alternates: { canonical: siteUrl("/chantiers") },
};

interface ChantierCard {
  slug: string;
  title: string;
  location?: string | null;
  status: string;
  progress_pct?: string | null;
  cover?: string | null;
  hiring: boolean;
}

/** Vitrine des chantiers en cours dont le panneau connecté est publié (I4). */
export default async function ChantiersPage() {
  const items = await publicGetSafe<ChantierCard[]>("/public/chantiers", []);
  return (
    <>
      <header data-hero="dark" className="noise relative isolate -mt-16 overflow-hidden bg-night pb-20 pt-40 text-white lg:-mt-20">
        <div className="absolute inset-0 -z-10 bg-blueprint opacity-40" />
        <div className="aurora-blob -left-24 top-10 h-72 w-72 bg-brand-500/40" />
        <div className="aurora-blob -right-24 bottom-0 h-72 w-72 bg-accent-500/30" />
        <div className="container-page relative">
          <p className="eyebrow text-accent-300">En direct</p>
          <h1 className="mt-4 max-w-3xl font-title text-4xl font-bold leading-tight text-white sm:text-6xl">
            Nos chantiers <span className="text-gradient-light">en cours</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-brand-100">
            Chaque panneau de chantier GLOBUS porte un QR code : riverains, futurs clients et curieux suivent l&apos;avancement réel, publié par nos équipes.
          </p>
        </div>
      </header>
      <section className="bg-white py-16 lg:py-24">
        <div className="container-page">
          {items.length ? (
            <Stagger className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((c) => {
                const pct = c.progress_pct !== null && c.progress_pct !== undefined ? Math.round(Number(c.progress_pct)) : null;
                return (
                  <Link key={c.slug} href={`/chantiers/${c.slug}`} className="group block overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-line transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="relative aspect-[16/10] overflow-hidden bg-night">
                      {c.cover ? (
                        <img src={c.cover} alt={c.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-blueprint opacity-60">
                          <HardHat className="h-12 w-12 text-white/60" />
                        </div>
                      )}
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> {optionLabel(c.status)}
                      </span>
                      {c.hiring ? (
                        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand-800">
                          <Users className="h-3.5 w-3.5" /> On recrute
                        </span>
                      ) : null}
                    </div>
                    <div className="p-6">
                      <h2 className="font-title text-xl font-bold text-brand-900">{c.title}</h2>
                      {c.location ? (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                          <MapPin className="h-4 w-4" /> {c.location}
                        </p>
                      ) : null}
                      {pct !== null ? (
                        <div className="mt-5">
                          <div className="flex justify-between text-xs font-semibold text-muted">
                            <span>Avancement</span>
                            <span className="tabular-nums text-brand-700">{pct} %</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      ) : null}
                      <p className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                        Suivre le chantier <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </p>
                    </div>
                  </Link>
                );
              })}
            </Stagger>
          ) : (
            <Reveal>
              <div className="mx-auto max-w-xl rounded-[1.75rem] bg-surface p-10 text-center ring-1 ring-line">
                <HardHat className="mx-auto h-12 w-12 text-brand-400" />
                <p className="mt-4 font-title text-xl font-bold text-brand-900">Aucun chantier publié pour le moment</p>
                <p className="mt-2 text-muted">Les chantiers apparaissent ici dès que leur panneau connecté est activé par nos équipes.</p>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </>
  );
}
