"use client";

import { Suspense } from "react";

import { AgendaView } from "@/components/agenda/agenda-view";

export default function ErpAgendaPage() {
  return (
    <Suspense>
      <AgendaView />
    </Suspense>
  );
}
