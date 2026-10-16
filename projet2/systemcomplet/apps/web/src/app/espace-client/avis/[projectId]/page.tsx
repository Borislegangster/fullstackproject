"use client";

import { use } from "react";

import { ClientReview } from "../client-review";
import { useClientProject } from "@/components/client/client-project";

/** Lien de la notification « Votre avis compte » : projet ciblé explicitement. */
export default function ClientReviewForProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { projects } = useClientProject();
  const project = projects?.find((p) => p.id === projectId);
  return <ClientReview projectId={projectId} projectName={project?.name} />;
}
