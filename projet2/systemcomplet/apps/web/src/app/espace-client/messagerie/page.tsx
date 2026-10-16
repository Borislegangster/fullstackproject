"use client";

import { Suspense } from "react";

import { useClientProject } from "@/components/client/client-project";
import { Messaging } from "@/components/comms/messaging";
import { PageTitle } from "@/components/ui/primitives";

export default function ClientMessagingPage() {
  const { project } = useClientProject();
  return (
    <div>
      <PageTitle title="Messagerie" subtitle="Échangez en toute sécurité avec votre chef de projet et l'équipe autorisée." />
      <Suspense>
        <Messaging projectId={project?.id} />
      </Suspense>
    </div>
  );
}
