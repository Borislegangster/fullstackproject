"use client";

import { Star } from "lucide-react";

import { ReviewForm } from "@/components/innovations/review-form";
import { Alert, PageTitle, Skeleton } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";

/** Avis depuis l'espace client (projet remis : réception / garantie). */
export function ClientReview({ projectId, projectName }: { projectId: string; projectName?: string }) {
  const { user } = useAuth();
  const state = useApi<{ invited: boolean; completed: boolean; eligible: boolean }>(`/client/projects/${projectId}/review`);
  if (state.loading && !state.data) return <Skeleton className="h-96 w-full" />;
  if (!state.data) return <Alert tone="danger">{state.error}</Alert>;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            <Star className="h-7 w-7 fill-accent-400 text-accent-500" /> Votre avis
          </span>
        }
        subtitle="Un avis vérifié, lié à votre chantier réel : il guide les futurs clients et nous aide à progresser."
      />
      {state.data.completed ? (
        <Alert tone="success" title="Merci !">
          Vous avez déjà partagé votre avis sur ce projet.
        </Alert>
      ) : !state.data.eligible ? (
        <Alert tone="info" title="Bientôt">
          Votre avis vous sera demandé à la remise des clés : vous pourrez alors juger l&apos;ensemble du projet.
        </Alert>
      ) : (
        <ReviewForm
          firstName={user?.first_name}
          projectName={projectName}
          submit={async (form) => {
            await api(`/client/projects/${projectId}/review`, { method: "POST", form });
          }}
        />
      )}
    </div>
  );
}
