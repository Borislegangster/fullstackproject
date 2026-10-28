"use client";

import { Suspense } from "react";

import { AgendaView } from "@/components/agenda/agenda-view";
import { useClientProject } from "@/components/client/client-project";

export default function ClientAgendaPage() {
  const { project } = useClientProject();
  return (
    <Suspense>
      <AgendaView projectId={project?.id} canCreate={false} canRequest title="Mes rendez-vous" />
    </Suspense>
  );
}
