import { HandCoins, Landmark, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FinancingPublic } from "./financing-public";
import { publicGetSafe, siteUrl } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Financer votre construction",
  description: "Simulez votre prêt, comparez nos établissements partenaires et transmettez votre dossier en un clic depuis votre espace client.",
  alternates: { canonical: siteUrl("/financement") },
};

/** Financement intégré (I5) : simulateur public. */
export default async function FinancingPage() {
  const status = await publicGetSafe<{ client_portal: boolean }>("/public/financing/status", { client_portal: false });
  return (
    <>
      <header data-hero="dark" className="noise relative isolate -mt-16 overflow-hidden bg-night pb-16 pt-40 text-white lg:-mt-20">
        <div className="absolute inset-0 -z-10 bg-blueprint opacity-40" />
        <div className="aurora-blob -left-24 top-10 h-72 w-72 bg-brand-500/40" />
        <div className="aurora-blob -right-24 bottom-0 h-72 w-72 bg-accent-500/30" />
        <div className="container-page relative">
          <p className="eyebrow text-accent-300">Financement</p>
          <h1 className="mt-4 max-w-3xl font-title text-4xl font-bold leading-tight text-white sm:text-6xl">
            Votre projet, <span className="text-gradient-light">financé sereinement</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-brand-100">
            Mensualités, taux d&apos;endettement, établissements éligibles : tout est clair avant même de nous rencontrer. Votre dossier se constitue
            une seule fois et part en un clic, avec votre accord.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-2">
              <Landmark className="h-4 w-4 text-accent-300" /> Banques et microfinance partenaires
            </span>
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-2">
              <HandCoins className="h-4 w-4 text-accent-300" /> Paiement échelonné Mobile Money
            </span>
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-2">
              <ShieldCheck className="h-4 w-4 text-accent-300" /> Dossier transmis avec votre accord
            </span>
          </div>
        </div>
      </header>
      <section className="bg-surface py-14 lg:py-20">
        <div className="container-page space-y-6">
          <FinancingPublic />
          <p className="text-center text-sm text-muted">
            {status.client_portal ? (
              <>
                Déjà client ?{" "}
                <Link href="/espace-client/financement" className="font-semibold text-brand-600 hover:underline">
                  Constituez votre dossier depuis votre espace
                </Link>{" "}
                ·{" "}
              </>
            ) : null}
            Pas encore client ?{" "}
            <Link href="/decrire-mon-projet" className="font-semibold text-brand-600 hover:underline">
              Décrivez votre projet
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
