"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Allocations, InventoryCounts, MovementsList, StockOverview, StockReferentials } from "@/components/erp/inventory";
import { Tabs } from "@/components/ui/overlay";
import { PageTitle } from "@/components/ui/primitives";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("onglet") ?? "vue";
  return (
    <div className="space-y-5">
      <PageTitle title="Stocks" subtitle="Entrées, sorties, lots, emplacements, affectations chantier, inventaires et valorisation (CMUP)." />
      <Tabs
        value={tab}
        onChange={(t) => router.replace(`/erp/stocks?onglet=${t}`, { scroll: false })}
        tabs={[
          { key: "vue", label: "État du stock" },
          { key: "mouvements", label: "Mouvements" },
          { key: "affectations", label: "Affectations chantier" },
          { key: "inventaires", label: "Inventaires" },
          { key: "referentiels", label: "Articles, dépôts, emplacements" },
        ]}
      />
      {tab === "vue" ? <StockOverview /> : null}
      {tab === "mouvements" ? <MovementsList /> : null}
      {tab === "affectations" ? <Allocations /> : null}
      {tab === "inventaires" ? <InventoryCounts /> : null}
      {tab === "referentiels" ? <StockReferentials /> : null}
    </div>
  );
}

export default function StocksPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
