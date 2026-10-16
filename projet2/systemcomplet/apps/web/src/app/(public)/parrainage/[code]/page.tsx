import { Gift, HeartHandshake, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ReferralWelcome } from "./referral-welcome";
import { publicGetOrNull } from "@/lib/server-api";

export const metadata: Metadata = { title: "Recommandé par un proche", robots: { index: false, follow: false } };

interface Landing {
  code: string;
  ambassador: string;
  benefit: string;
  attribution_days: number;
}

/** Lien ambassadeur (I6) : accueil personnalisé, code mémorisé pour la demande de projet. */
export default async function ReferralLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const landing = await publicGetOrNull<Landing>(`/public/referrals/${encodeURIComponent(code)}`, undefined, { fresh: true }).catch(() => null);
  return (
    <section className="relative isolate -mt-16 overflow-hidden bg-night pb-24 pt-40 text-white lg:-mt-20" data-hero="dark">
      <div className="absolute inset-0 -z-10 bg-blueprint opacity-40" />
      <div className="aurora-blob -left-24 top-16 h-80 w-80 bg-accent-500/40" />
      <div className="aurora-blob -right-24 bottom-0 h-80 w-80 bg-brand-500/40" />
      <div className="container-page relative max-w-4xl text-center">
        {landing ? (
          <>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-accent-200 ring-1 ring-white/20">
              <HeartHandshake className="h-4 w-4" /> Recommandé par {landing.ambassador}
            </p>
            <h1 className="mt-6 font-title text-4xl font-bold leading-tight text-white sm:text-6xl">
              Construisez avec la <span className="text-gradient-light">confiance</span> de vos proches
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-brand-100">
              {landing.ambassador} a fait construire avec GLOBUS ENGINEERING et vous recommande. Conception, calcul, construction et contrôle : un seul
              interlocuteur, un suivi en ligne transparent.
            </p>
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-2">
              <div className="glass-dark rounded-2xl p-5">
                <Gift className="h-6 w-6 text-accent-300" />
                <p className="mt-2 font-semibold">Votre avantage</p>
                <p className="text-sm text-brand-100">{landing.benefit}.</p>
              </div>
              <div className="glass-dark rounded-2xl p-5">
                <ShieldCheck className="h-6 w-6 text-accent-300" />
                <p className="mt-2 font-semibold">Aucun engagement</p>
                <p className="text-sm text-brand-100">Décrivez votre projet : un ingénieur vous recontacte sous 24 h ouvrées.</p>
              </div>
            </div>
            <ReferralWelcome code={landing.code} days={landing.attribution_days} />
          </>
        ) : (
          <>
            <h1 className="font-title text-4xl font-bold text-white">Lien de recommandation expiré</h1>
            <p className="mx-auto mt-4 max-w-xl text-brand-100">Ce code n&apos;est plus actif, mais nos équipes restent à votre écoute.</p>
            <Link href="/decrire-mon-projet" className="mt-8 inline-flex rounded-full bg-accent-500 px-6 py-3 font-semibold text-white shadow-lg hover:bg-accent-600">
              Décrire mon projet
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
