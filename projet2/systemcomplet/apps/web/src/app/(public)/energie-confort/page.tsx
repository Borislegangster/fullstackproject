import { Leaf, Sun, ThermometerSun } from "lucide-react";
import type { Metadata } from "next";

import { EnergyPublic } from "./energy-public";
import { siteUrl } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Énergie & confort — simulez vos économies",
  description:
    "Isolation, protections solaires, climatisation inverter, panneaux solaires et batterie : estimez votre facture, votre confort et votre autonomie pendant les délestages.",
  alternates: { canonical: siteUrl("/energie-confort") },
};

/** Offre « énergie & confort » (I3) : simulateur public. */
export default function EnergyPage() {
  return (
    <>
      <header data-hero="dark" className="noise relative isolate -mt-16 overflow-hidden bg-night pb-16 pt-40 text-white lg:-mt-20">
        <div className="absolute inset-0 -z-10 bg-blueprint opacity-40" />
        <div className="aurora-blob -left-24 top-10 h-72 w-72 bg-accent-500/40" />
        <div className="aurora-blob -right-24 bottom-0 h-72 w-72 bg-emerald-500/30" />
        <div className="container-page relative">
          <p className="eyebrow text-accent-300">Énergie & confort</p>
          <h1 className="mt-4 max-w-3xl font-title text-4xl font-bold leading-tight text-white sm:text-6xl">
            Une maison plus fraîche, une facture <span className="text-gradient-light">divisée</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-brand-100">
            Conçue dès le départ pour le climat camerounais : moins de chaleur, moins de climatisation, du solaire et de l&apos;autonomie quand le réseau
            coupe.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-2">
              <ThermometerSun className="h-4 w-4 text-accent-300" /> Confort thermique
            </span>
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-2">
              <Sun className="h-4 w-4 text-accent-300" /> Solaire et batterie
            </span>
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-2">
              <Leaf className="h-4 w-4 text-accent-300" /> CO₂ évité
            </span>
          </div>
        </div>
      </header>
      <section className="bg-surface py-14 lg:py-20">
        <div className="container-page">
          <EnergyPublic />
        </div>
      </section>
    </>
  );
}
