import type { Metadata } from "next";

import { VisitPlayer } from "./visit-player";

export const metadata: Metadata = { title: "Visite immersive", robots: { index: false, follow: false } };

/** Visite immersive partagée (R5) : ouverte sans compte, sur lien sécurisé (expiration, PIN facultatif). */
export default async function VisitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <section className="relative -mt-16 min-h-[100svh] overflow-hidden bg-night pb-16 pt-28 text-white lg:-mt-20" data-hero="dark">
      <div className="absolute inset-0 bg-blueprint opacity-30" />
      <div className="aurora-blob -left-24 top-10 h-80 w-80 bg-brand-500/40" />
      <div className="aurora-blob -right-24 bottom-0 h-80 w-80 bg-accent-500/30" />
      <div className="container-page relative">
        <VisitPlayer token={token} />
      </div>
    </section>
  );
}
