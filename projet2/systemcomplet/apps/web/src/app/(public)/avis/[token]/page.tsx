import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { PublicReview } from "./public-review";
import { publicGetOrNull } from "@/lib/server-api";

export const metadata: Metadata = { title: "Votre avis", robots: { index: false, follow: false } };

interface InvitationInfo {
  first_name: string;
  project_name: string;
  city?: string | null;
  company: string;
  status: string;
}

/** Lien nominatif d'avis vérifié : seul le client invité peut déposer son avis sur son propre chantier. */
export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await publicGetOrNull<InvitationInfo>(`/public/reviews/${encodeURIComponent(token)}`, undefined, { fresh: true }).catch(() => null);
  return (
    <section className="relative overflow-hidden bg-surface py-14 lg:py-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-accent-100/50 via-brand-50/40 to-transparent" aria-hidden="true" />
      <div className="container-page relative max-w-3xl">
        {info ? (
          <>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Avis vérifié — lié à votre chantier
            </p>
            <h1 className="mt-4 font-title text-3xl font-extrabold text-brand-800 sm:text-4xl">Bonjour {info.first_name}, votre avis compte.</h1>
            <p className="mt-2 text-muted">
              {info.company} a réalisé « {info.project_name} »{info.city ? ` à ${info.city}` : ""}. Deux minutes suffisent pour partager votre expérience avec
              les futurs clients.
            </p>
            <div className="mt-8">
              {info.status === "completed" ? (
                <p className="rounded-2xl bg-white p-6 text-center text-muted ring-1 ring-line">Vous avez déjà déposé votre avis. Merci !</p>
              ) : (
                <PublicReview token={token} firstName={info.first_name} projectName={info.project_name} />
              )}
            </div>
          </>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-line">
            <h1 className="text-2xl font-bold text-brand-800">Lien expiré ou remplacé</h1>
            <p className="mt-2 text-muted">Ce lien personnel n&apos;est plus valable. Votre chef de projet peut vous en envoyer un nouveau, ou déposez votre avis depuis votre espace client.</p>
          </div>
        )}
      </div>
    </section>
  );
}
