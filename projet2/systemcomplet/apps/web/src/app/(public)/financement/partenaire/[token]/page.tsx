import type { Metadata } from "next";

import { PartnerDossier } from "./partner-dossier";

export const metadata: Metadata = { title: "Dossier de financement", robots: { index: false, follow: false } };

/** Portail d'instruction des établissements partenaires (I5) : lien nominatif, sans compte. */
export default async function PartnerDossierPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <section className="bg-surface py-12 lg:py-16">
      <div className="container-page max-w-5xl">
        <PartnerDossier token={token} />
      </div>
    </section>
  );
}
