"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { DeliveriesList, ReceiptsList, SupplierReturns } from "@/components/erp/deliveries";
import { Tabs } from "@/components/ui/overlay";
import { PageTitle } from "@/components/ui/primitives";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const po = params.get("po");
  const tab = params.get("onglet") ?? "livraisons";
  return (
    <div className="space-y-5">
      <PageTitle title="Livraisons et réceptions" subtitle="Expéditions annoncées, arrivées sur chantier, réceptions contrôlées avec preuves, écarts et retours." />
      <Tabs
        value={tab}
        onChange={(t) => router.replace(`/erp/livraisons?onglet=${t}${po ? `&po=${po}` : ""}`, { scroll: false })}
        tabs={[
          { key: "livraisons", label: "Livraisons" },
          { key: "receptions", label: "Réceptions" },
          { key: "retours", label: "Retours fournisseurs" },
        ]}
      />
      {tab === "livraisons" ? <DeliveriesList purchaseOrderId={po ?? undefined} /> : null}
      {tab === "receptions" ? <ReceiptsList /> : null}
      {tab === "retours" ? <SupplierReturns /> : null}
    </div>
  );
}

export default function DeliveriesPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
