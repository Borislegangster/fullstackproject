"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ClaimsList, DisputesList } from "@/components/erp/subcontracting";
import { Tabs } from "@/components/ui/overlay";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "litiges";
  return (
    <div className="space-y-5">
      <Tabs
        value={tab}
        onChange={(t) => router.replace(`/erp/litiges?onglet=${t}`, { scroll: false })}
        tabs={[
          { key: "litiges", label: "Litiges" },
          { key: "reclamations", label: "Réclamations" },
        ]}
      />
      {tab === "reclamations" ? <ClaimsList /> : <DisputesList />}
    </div>
  );
}

export default function DisputesPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
