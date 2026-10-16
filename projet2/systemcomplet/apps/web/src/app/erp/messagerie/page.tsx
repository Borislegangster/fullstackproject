"use client";

import { Suspense } from "react";

import { Messaging } from "@/components/comms/messaging";
import { PageTitle } from "@/components/ui/primitives";

export default function ErpMessagingPage() {
  return (
    <div>
      <PageTitle title="Messagerie" subtitle="Conversations directes, de groupe et de projet ; pièces jointes, accusés de lecture, appels." />
      <Suspense>
        <Messaging />
      </Suspense>
    </div>
  );
}
