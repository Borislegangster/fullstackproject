"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SituationsList } from "@/components/erp/subcontracting";

function Inner() {
  const params = useSearchParams();
  return <SituationsList status={params.get("statut") ?? undefined} />;
}

export default function SituationsPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
