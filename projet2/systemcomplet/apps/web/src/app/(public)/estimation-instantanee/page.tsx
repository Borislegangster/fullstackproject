import { Camera, Mic, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { InstantEstimate } from "@/components/site/instant-estimate";
import { siteUrl } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Estimation instantanée de votre projet",
  description: "Une photo du terrain, un croquis ou une note vocale : obtenez en quelques secondes une fourchette budgétaire indicative, validée ensuite par un ingénieur GLOBUS.",
  alternates: { canonical: siteUrl("/estimation-instantanee") },
};

/** Devis budgétaire instantané par IA (A2). */
export default function InstantEstimatePage() {
  return (
    <>
      <header data-hero="dark" className="noise relative isolate -mt-16 overflow-hidden bg-night pb-16 pt-40 text-white lg:-mt-20">
        <div className="absolute inset-0 -z-10 bg-blueprint opacity-40" />
        <div className="aurora-blob -left-24 top-10 h-72 w-72 bg-accent-500/40" />
        <div className="aurora-blob -right-24 bottom-0 h-72 w-72 bg-brand-500/40" />
        <div className="container-page relative">
          <p className="eyebrow text-accent-300">Nouveau</p>
          <h1 className="mt-4 max-w-3xl font-title text-4xl font-bold leading-tight text-white sm:text-6xl">
            Votre budget en <span className="text-gradient-light">quelques secondes</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-brand-100">
            Photographiez votre terrain, ajoutez un croquis ou dictez votre idée : notre assistant extrait surface, niveaux et contraintes, nos barèmes
            calculent la fourchette, un ingénieur la valide.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            {[
              [Camera, "Photo ou croquis"],
              [Mic, "Note vocale"],
              [Sparkles, "Analyse instantanée"],
              [ShieldCheck, "Validée par un ingénieur"],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Camera;
              return (
                <span key={label as string} className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-2">
                  <I className="h-4 w-4 text-accent-300" /> {label as string}
                </span>
              );
            })}
          </div>
        </div>
      </header>
      <section className="bg-surface py-14 lg:py-20">
        <div className="container-page max-w-5xl">
          <InstantEstimate />
        </div>
      </section>
    </>
  );
}
