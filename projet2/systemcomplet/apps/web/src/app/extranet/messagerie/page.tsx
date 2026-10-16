"use client";

import { Suspense } from "react";

import { Messaging } from "@/components/comms/messaging";
import { PageTitle } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";

export default function ExtranetMessagingPage() {
  const { can } = useAuth();
  return (
    <div>
      <PageTitle title="Messagerie" subtitle="Échanges sécurisés avec vos interlocuteurs GLOBUS (conducteur de travaux, achats, comptabilité)." />
      <Suspense>
        <Messaging canCall={can("calls:use")} />
      </Suspense>
    </div>
  );
}
